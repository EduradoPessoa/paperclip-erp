/**
 * Fiscal service — Paperclip ERP.
 *
 * Company-scoped orchestration of the fiscal module: document drafts, provider
 * bindings, transmission lifecycle (transmit/consult/cancel) and the
 * append-only fiscal event trail. Every mutation records an actor; fiscal
 * events are never updated or deleted by contract.
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  cases,
  fiscalDocumentItems,
  fiscalDocumentLinks,
  fiscalDocuments,
  fiscalDocumentTaxes,
  fiscalEvents,
  fiscalProviderBindings,
  issues,
} from "@paperclipai/db";
import type {
  CreateFiscalDocument,
  FiscalDocumentModel,
  FiscalEmitRequest,
  FiscalFetchRequest,
  FiscalManifestationKind,
  FiscalPartyInput,
  FiscalProviderBinding,
  FiscalProviderBindingConfig,
  FiscalSplitPaymentInput,
  FiscalTaxLineInput,
  UpsertFiscalProviderBinding,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { assertSupportedFiscalProviderKey, getFiscalProviderFactory } from "../fiscal/registry.js";
import type { ResolvedFiscalProviderConfig } from "../fiscal/provider.js";
import { financeService } from "./finance.js";
import { publishLiveEvent } from "./live-events.js";

export interface FiscalActor {
  actorType: "user" | "agent" | "system";
  actorId: string;
  agentId: string | null;
  runId: string | null;
}

export interface FiscalListOptions {
  status?: string;
  model?: string;
  limit: number;
  offset: number;
}

/** Injected dependencies keep the service decoupled from the secrets stack. */
export interface FiscalServiceDeps {
  /**
   * Resolves a company secret by name to its plaintext value (F2: wired to
   * `secretService.resolveSecretValue` in the routes). Returns null when the
   * secret does not exist or has no value.
   */
  resolveCompanySecret?: (companyId: string, name: string) => Promise<string | null>;
  /**
   * Persists a document file (XML/DANFE) to company storage and returns the
   * `assets` row id (F3: wired to storageService.putFile + assetService.create
   * in the routes). Returns null when persistence is unavailable.
   */
  persistFile?: (input: {
    companyId: string;
    filename: string;
    contentType: string;
    body: Buffer;
    actor: FiscalActor;
  }) => Promise<string | null>;
}

/** Provider callback payload accepted on the webhook endpoint. */
export interface FiscalProviderCallbackInput {
  accessKey: string;
  status: string;
  protocol?: string | null;
  message?: string | null;
  eventKind?: string | null;
  providerDocumentId?: string | null;
}

export function mapCallbackStatusToDocumentStatus(status: string): string {
  switch (status) {
    case "authorized":
      return "authorized";
    case "rejected":
      return "rejected";
    case "denied":
      return "denied";
    case "cancelled":
      return "cancelled";
    case "invalidated":
      return "invalidated";
    case "error":
      return "error";
    default:
      return "transmitted";
  }
}

export function mapEmitStatusToDocumentStatus(status: string): string {
  switch (status) {
    case "authorized":
      return "authorized";
    case "rejected":
      return "rejected";
    case "denied":
      return "denied";
    case "error":
      return "error";
    default:
      return "transmitted";
  }
}

export function fiscalService(db: Db, deps: FiscalServiceDeps = {}) {
  async function assertBelongsToCompany(
    table: typeof fiscalDocuments,
    id: string,
    companyId: string,
    label: string,
  ) {
    const row = await db
      .select()
      .from(table)
      .where(eq(table.id, id))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound(`${label} not found`);
    if (row.companyId !== companyId) {
      throw unprocessable(`${label} does not belong to company`);
    }
    return row;
  }

  async function assertCaseInCompany(caseId: string | null | undefined, companyId: string) {
    if (!caseId) return;
    const row = await db.select({ id: cases.id, companyId: cases.companyId }).from(cases).where(eq(cases.id, caseId)).limit(1);
    if (row.length === 0) throw notFound("Case not found");
    if (row[0]!.companyId !== companyId) throw unprocessable("Case does not belong to company");
  }

  async function assertIssueInCompany(issueId: string | null | undefined, companyId: string) {
    if (!issueId) return;
    const row = await db.select({ id: issues.id, companyId: issues.companyId }).from(issues).where(eq(issues.id, issueId)).limit(1);
    if (row.length === 0) throw notFound("Issue not found");
    if (row[0]!.companyId !== companyId) throw unprocessable("Issue does not belong to company");
  }

  async function insertEvent(input: {
    companyId: string;
    fiscalDocumentId: string;
    kind: string;
    actor: FiscalActor;
    payload?: Record<string, unknown>;
    providerEventKind?: string | null;
  }) {
    return db
      .insert(fiscalEvents)
      .values({
        companyId: input.companyId,
        fiscalDocumentId: input.fiscalDocumentId,
        kind: input.kind,
        actorType: input.actor.actorType,
        actorUserId: input.actor.actorType === "user" ? input.actor.actorId : null,
        actorAgentId: input.actor.actorType === "agent" ? input.actor.agentId : null,
        runId: input.actor.runId,
        providerEventKind: input.providerEventKind ?? null,
        payload: input.payload ?? {},
      })
      .returning()
      .then((rows) => rows[0]);
  }

  async function loadItems(companyId: string, fiscalDocumentId: string) {
    return db
      .select()
      .from(fiscalDocumentItems)
      .where(
        and(
          eq(fiscalDocumentItems.companyId, companyId),
          eq(fiscalDocumentItems.fiscalDocumentId, fiscalDocumentId),
        ),
      )
      .orderBy(asc(fiscalDocumentItems.position));
  }

  async function loadTaxes(companyId: string, fiscalDocumentId: string) {
    return db
      .select()
      .from(fiscalDocumentTaxes)
      .where(
        and(
          eq(fiscalDocumentTaxes.companyId, companyId),
          eq(fiscalDocumentTaxes.fiscalDocumentId, fiscalDocumentId),
        ),
      );
  }

  async function loadDetail(companyId: string, fiscalDocumentId: string) {
    const doc = await assertBelongsToCompany(fiscalDocuments, fiscalDocumentId, companyId, "Fiscal document");
    const [items, taxes, events, links] = await Promise.all([
      loadItems(companyId, fiscalDocumentId),
      loadTaxes(companyId, fiscalDocumentId),
      db
        .select()
        .from(fiscalEvents)
        .where(
          and(
            eq(fiscalEvents.companyId, companyId),
            eq(fiscalEvents.fiscalDocumentId, fiscalDocumentId),
          ),
        )
        .orderBy(desc(fiscalEvents.createdAt)),
      db
        .select()
        .from(fiscalDocumentLinks)
        .where(
          and(
            eq(fiscalDocumentLinks.companyId, companyId),
            eq(fiscalDocumentLinks.fiscalDocumentId, fiscalDocumentId),
          ),
        ),
    ]);
    return { document: doc, items, taxes, events, links };
  }

  async function resolveBinding(companyId: string, model: FiscalDocumentModel) {
    const rows = await db
      .select()
      .from(fiscalProviderBindings)
      .where(
        and(eq(fiscalProviderBindings.companyId, companyId), eq(fiscalProviderBindings.enabled, true)),
      )
      .orderBy(asc(fiscalProviderBindings.createdAt));
    if (rows.length === 0) {
      throw unprocessable(`No enabled fiscal provider binding for company ${companyId}`);
    }
    const covering = rows.find((row) => {
      const models = row.documentModels as FiscalDocumentModel[] | null;
      return !models || models.length === 0 || models.includes(model);
    });
    return covering ?? rows[0]!;
  }

  async function resolveProviderConfig(
    binding: { providerKey: string; config: Record<string, unknown> },
    companyId: string,
  ): Promise<ResolvedFiscalProviderConfig> {
    const config = binding.config;
    const extra = config.extra as Record<string, unknown> | undefined;
    let apiKey = typeof extra?.apiKey === "string" ? extra.apiKey : undefined;
    const secretRef = typeof config.apiKeySecretRef === "string" ? config.apiKeySecretRef : undefined;
    if (secretRef && !apiKey) {
      if (!deps.resolveCompanySecret) {
        throw unprocessable(
          "Fiscal provider binding uses apiKeySecretRef but secret resolution is not wired (provide resolveCompanySecret)",
        );
      }
      apiKey = (await deps.resolveCompanySecret(companyId, secretRef)) ?? undefined;
      if (!apiKey) {
        throw unprocessable(`Fiscal provider secret "${secretRef}" not found or has no value`);
      }
    }
    return {
      baseUrl: typeof config.baseUrl === "string" ? config.baseUrl : "https://api.spedy.br",
      environment: config.environment === "production" ? "production" : "homologation",
      apiKey,
      extra,
    };
  }

  function publishStatusChanged(input: {
    companyId: string;
    document: { id: string; model: string; accessKey: string; status: string };
    providerKey?: string | null;
  }) {
    publishLiveEvent({
      companyId: input.companyId,
      type: "fiscal.document.status_changed",
      payload: {
        documentId: input.document.id,
        model: input.document.model,
        accessKey: input.document.accessKey,
        status: input.document.status,
        providerKey: input.providerKey ?? null,
      },
    });
  }

  /** Best-effort XML retention: persists the provider-signed XML as an asset. */
  async function maybePersistSignedXml(input: {
    companyId: string;
    fiscalDocumentId: string;
    doc: { id: string; accessKey: string; xmlAssetId: string | null };
    signedXml?: string | null;
    actor: FiscalActor;
  }) {
    if (!deps.persistFile || !input.signedXml || input.doc.xmlAssetId) return;
    try {
      const assetId = await deps.persistFile({
        companyId: input.companyId,
        filename: `${input.doc.accessKey}.xml`,
        contentType: "application/xml",
        body: Buffer.from(input.signedXml, "utf8"),
        actor: input.actor,
      });
      if (assetId) {
        await db
          .update(fiscalDocuments)
          .set({ xmlAssetId: assetId, updatedAt: new Date() })
          .where(
            and(eq(fiscalDocuments.id, input.fiscalDocumentId), eq(fiscalDocuments.companyId, input.companyId)),
          );
      }
    } catch (error) {
      await insertEvent({
        companyId: input.companyId,
        fiscalDocumentId: input.fiscalDocumentId,
        kind: "error",
        actor: input.actor,
        payload: {
          action: "xml_persist_failed",
          message: error instanceof Error ? error.message : String(error),
        },
      }).catch(() => undefined);
    }
  }

  return {
    createDraft: async (companyId: string, input: CreateFiscalDocument, actor: FiscalActor) => {
      await assertCaseInCompany(input.caseId, companyId);
      await assertIssueInCompany(input.issueId, companyId);

      const [doc] = await db
        .insert(fiscalDocuments)
        .values({
          companyId,
          caseId: input.caseId ?? null,
          issueId: input.issueId ?? null,
          model: input.model,
          operationDirection: input.operationDirection,
          status: "draft",
          accessKey: input.accessKey,
          number: input.number,
          series: input.series,
          emitter: input.emitter as unknown as Record<string, unknown>,
          receiver: input.receiver ? (input.receiver as unknown as Record<string, unknown>) : null,
          emitterTaxId: input.emitter.taxId,
          receiverTaxId: input.receiver?.taxId ?? null,
          totalsCents: input.totalsCents,
          splitPayment: input.splitPayment
            ? (input.splitPayment as unknown as Record<string, unknown>)
            : null,
          providerExtras: input.providerExtras ?? null,
          createdByUserId: actor.actorType === "user" ? actor.actorId : null,
          createdByAgentId: actor.actorType === "agent" ? actor.agentId : null,
        })
        .returning();

      const insertedItems: Array<{ id: string; position: number }> = [];
      for (const [index, item] of input.items.entries()) {
        const [itemRow] = await db
          .insert(fiscalDocumentItems)
          .values({
            companyId,
            fiscalDocumentId: doc!.id,
            position: index,
            ncm: item.ncm ?? null,
            cest: item.cest ?? null,
            cfop: item.cfop ?? null,
            description: item.description,
            quantity: String(item.quantity),
            unit: item.unit,
            unitPriceCents: item.unitPriceCents,
            totalCents: item.totalCents,
          })
          .returning();
        insertedItems.push({ id: itemRow!.id, position: index });

        for (const tax of item.taxes ?? []) {
          await db.insert(fiscalDocumentTaxes).values({
            companyId,
            fiscalDocumentId: doc!.id,
            fiscalDocumentItemId: itemRow!.id,
            taxType: tax.taxType,
            baseCents: tax.baseCents,
            rateBps: tax.rateBps,
            amountCents: tax.amountCents,
            creditable: tax.creditable,
          });
        }
      }

      for (const tax of input.taxes ?? []) {
        await db.insert(fiscalDocumentTaxes).values({
          companyId,
          fiscalDocumentId: doc!.id,
          fiscalDocumentItemId: null,
          taxType: tax.taxType,
          baseCents: tax.baseCents,
          rateBps: tax.rateBps,
          amountCents: tax.amountCents,
          creditable: tax.creditable,
        });
      }

      if (input.caseId || input.issueId) {
        await db.insert(fiscalDocumentLinks).values({
          companyId,
          fiscalDocumentId: doc!.id,
          caseId: input.caseId ?? null,
          issueId: input.issueId ?? null,
          role: "origin",
          runId: actor.actorType === "agent" ? actor.runId : null,
        });
      }

      await insertEvent({
        companyId,
        fiscalDocumentId: doc!.id,
        kind: "created",
        actor,
        payload: { model: input.model, accessKey: input.accessKey, number: input.number, series: input.series },
      });

      return loadDetail(companyId, doc!.id);
    },

    list: async (companyId: string, options: FiscalListOptions) => {
      const conditions = [eq(fiscalDocuments.companyId, companyId)];
      if (options.status) conditions.push(eq(fiscalDocuments.status, options.status));
      if (options.model) conditions.push(eq(fiscalDocuments.model, options.model));
      const rows = await db
        .select()
        .from(fiscalDocuments)
        .where(and(...conditions))
        .orderBy(desc(fiscalDocuments.createdAt))
        .limit(options.limit)
        .offset(options.offset);
      return rows;
    },

    getDetail: loadDetail,

    listBindings: async (companyId: string) => {
      return db
        .select()
        .from(fiscalProviderBindings)
        .where(eq(fiscalProviderBindings.companyId, companyId))
        .orderBy(asc(fiscalProviderBindings.createdAt));
    },

    upsertBinding: async (
      companyId: string,
      input: UpsertFiscalProviderBinding,
      actor: FiscalActor,
    ) => {
      assertSupportedFiscalProviderKey(input.providerKey);

      const [binding] = await db
        .insert(fiscalProviderBindings)
        .values({
          companyId,
          providerKey: input.providerKey,
          documentModels: input.documentModels ?? [],
          config: input.config as unknown as Record<string, unknown>,
          enabled: input.enabled ?? true,
          createdByUserId: actor.actorType === "user" ? actor.actorId : null,
          createdByAgentId: actor.actorType === "agent" ? actor.agentId : null,
        })
        .onConflictDoUpdate({
          target: [fiscalProviderBindings.companyId, fiscalProviderBindings.providerKey],
          set: {
            documentModels: input.documentModels ?? [],
            config: input.config as unknown as Record<string, unknown>,
            enabled: input.enabled ?? true,
            updatedAt: new Date(),
          },
        })
        .returning();
      return binding;
    },

    transmit: async (companyId: string, fiscalDocumentId: string, actor: FiscalActor) => {
      const doc = await assertBelongsToCompany(fiscalDocuments, fiscalDocumentId, companyId, "Fiscal document");
      if (!["draft", "validated", "error"].includes(doc.status)) {
        throw conflict(`Fiscal document cannot be transmitted from status "${doc.status}"`);
      }

      const binding = await resolveBinding(companyId, doc.model as FiscalDocumentModel);
      const providerConfig = await resolveProviderConfig(binding, companyId);
      const provider = getFiscalProviderFactory(binding.providerKey)(providerConfig);
      const [items, taxes] = await Promise.all([
        loadItems(companyId, fiscalDocumentId),
        loadTaxes(companyId, fiscalDocumentId),
      ]);

      const itemTaxesByItemId = new Map<string, FiscalTaxLineInput[]>();
      for (const tax of taxes) {
        if (!tax.fiscalDocumentItemId) continue;
        const list = itemTaxesByItemId.get(tax.fiscalDocumentItemId) ?? [];
        list.push({
          taxType: tax.taxType as FiscalTaxLineInput["taxType"],
          baseCents: tax.baseCents,
          rateBps: tax.rateBps,
          amountCents: tax.amountCents,
          creditable: tax.creditable,
        });
        itemTaxesByItemId.set(tax.fiscalDocumentItemId, list);
      }

      const emitRequest: FiscalEmitRequest = {
        companyId,
        documentId: doc.id,
        model: doc.model as FiscalDocumentModel,
        environment: providerConfig.environment,
        accessKey: doc.accessKey,
        number: doc.number,
        series: doc.series,
        operationDirection: doc.operationDirection as "inbound" | "outbound",
        emitter: doc.emitter as unknown as FiscalPartyInput,
        receiver: doc.receiver ? (doc.receiver as unknown as FiscalPartyInput) : null,
        items: items.map((item) => ({
          ncm: item.ncm ?? null,
          cest: item.cest ?? null,
          cfop: item.cfop ?? null,
          description: item.description,
          quantity: Number(item.quantity),
          unit: item.unit,
          unitPriceCents: item.unitPriceCents,
          totalCents: item.totalCents,
          taxes: itemTaxesByItemId.get(item.id) ?? [],
        })),
        totalsCents: doc.totalsCents,
        taxes: taxes.filter((tax) => !tax.fiscalDocumentItemId).map((tax) => ({
          taxType: tax.taxType as FiscalTaxLineInput["taxType"],
          baseCents: tax.baseCents,
          rateBps: tax.rateBps,
          amountCents: tax.amountCents,
          creditable: tax.creditable,
        })),
        splitPayment: doc.splitPayment
          ? (doc.splitPayment as unknown as FiscalSplitPaymentInput)
          : null,
        providerExtras: doc.providerExtras ?? undefined,
      };

      const result = await provider.emit(emitRequest);

      const nextStatus = mapEmitStatusToDocumentStatus(result.status);
      await db
        .update(fiscalDocuments)
        .set({
          status: nextStatus,
          providerKey: binding.providerKey,
          providerDocumentId: result.providerDocumentId ?? null,
          protocol: result.protocol ?? null,
          errorMessage: result.message ?? null,
          providerRaw: result.providerRaw ?? null,
          authorizedAt: result.status === "authorized" ? new Date() : doc.authorizedAt,
          updatedAt: new Date(),
        })
        .where(and(eq(fiscalDocuments.id, fiscalDocumentId), eq(fiscalDocuments.companyId, companyId)));

      await insertEvent({
        companyId,
        fiscalDocumentId,
        kind: result.status === "authorized" ? "authorized" : "transmitted",
        actor,
        payload: {
          providerKey: binding.providerKey,
          providerDocumentId: result.providerDocumentId ?? null,
          protocol: result.protocol ?? null,
          status: nextStatus,
          message: result.message ?? null,
        },
      });

      publishStatusChanged({
        companyId,
        document: { id: doc.id, model: doc.model, accessKey: doc.accessKey, status: nextStatus },
        providerKey: binding.providerKey,
      });

      await maybePersistSignedXml({
        companyId,
        fiscalDocumentId,
        doc: { id: doc.id, accessKey: doc.accessKey, xmlAssetId: doc.xmlAssetId },
        signedXml: result.signedXml,
        actor,
      });

      return { document: await loadDetail(companyId, fiscalDocumentId), providerResult: result };
    },

    consult: async (companyId: string, fiscalDocumentId: string, actor: FiscalActor) => {
      const doc = await assertBelongsToCompany(fiscalDocuments, fiscalDocumentId, companyId, "Fiscal document");
      if (!doc.providerKey || !doc.providerDocumentId) {
        throw conflict("Fiscal document has no provider reference to consult");
      }
      const binding = await resolveBinding(companyId, doc.model as FiscalDocumentModel);
      const providerConfig = await resolveProviderConfig(binding, companyId);
      const provider = getFiscalProviderFactory(binding.providerKey)(providerConfig);

      const result = await provider.consult({
        companyId,
        documentId: doc.id,
        providerDocumentId: doc.providerDocumentId,
        accessKey: doc.accessKey,
        environment: providerConfig.environment,
      });

      const nextStatus = mapEmitStatusToDocumentStatus(result.status === "cancelled" ? "cancelled" : result.status);
      await db
        .update(fiscalDocuments)
        .set({
          status: nextStatus,
          protocol: result.protocol ?? doc.protocol,
          errorMessage: result.message ?? null,
          providerRaw: result.providerRaw ?? null,
          authorizedAt: result.status === "authorized" ? new Date() : doc.authorizedAt,
          cancelledAt: result.status === "cancelled" ? new Date() : doc.cancelledAt,
          updatedAt: new Date(),
        })
        .where(and(eq(fiscalDocuments.id, fiscalDocumentId), eq(fiscalDocuments.companyId, companyId)));

      await insertEvent({
        companyId,
        fiscalDocumentId,
        kind: result.status === "cancelled" ? "cancelled" : "transmitted",
        actor,
        payload: { status: nextStatus, protocol: result.protocol ?? null, message: result.message ?? null },
      });

      publishStatusChanged({
        companyId,
        document: { id: doc.id, model: doc.model, accessKey: doc.accessKey, status: nextStatus },
        providerKey: doc.providerKey,
      });

      await maybePersistSignedXml({
        companyId,
        fiscalDocumentId,
        doc: { id: doc.id, accessKey: doc.accessKey, xmlAssetId: doc.xmlAssetId },
        signedXml: result.signedXml,
        actor,
      });

      return { document: await loadDetail(companyId, fiscalDocumentId), providerResult: result };
    },

    cancel: async (
      companyId: string,
      fiscalDocumentId: string,
      justification: string,
      actor: FiscalActor,
    ) => {
      const doc = await assertBelongsToCompany(fiscalDocuments, fiscalDocumentId, companyId, "Fiscal document");
      if (doc.status !== "authorized" && doc.status !== "transmitted") {
        throw conflict(`Fiscal document cannot be cancelled from status "${doc.status}"`);
      }
      if (!doc.providerKey || !doc.providerDocumentId) {
        throw conflict("Fiscal document has no provider reference to cancel");
      }
      const binding = await resolveBinding(companyId, doc.model as FiscalDocumentModel);
      const providerConfig = await resolveProviderConfig(binding, companyId);
      const provider = getFiscalProviderFactory(binding.providerKey)(providerConfig);

      const result = await provider.cancel({
        companyId,
        documentId: doc.id,
        providerDocumentId: doc.providerDocumentId,
        accessKey: doc.accessKey,
        justification,
        environment: providerConfig.environment,
      });

      if (result.status !== "cancelled") {
        await insertEvent({
          companyId,
          fiscalDocumentId,
          kind: "error",
          actor,
          payload: { message: result.message ?? "cancel not confirmed by provider" },
        });
        throw conflict(result.message ?? "Provider did not confirm cancellation");
      }

      await db
        .update(fiscalDocuments)
        .set({
          status: "cancelled",
          protocol: result.protocol ?? doc.protocol,
          errorMessage: null,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(fiscalDocuments.id, fiscalDocumentId), eq(fiscalDocuments.companyId, companyId)));

      await insertEvent({
        companyId,
        fiscalDocumentId,
        kind: "cancelled",
        actor,
        payload: { justification, protocol: result.protocol ?? null },
      });

      publishStatusChanged({
        companyId,
        document: { id: doc.id, model: doc.model, accessKey: doc.accessKey, status: "cancelled" },
        providerKey: doc.providerKey,
      });

      return { document: await loadDetail(companyId, fiscalDocumentId), providerResult: result };
    },

    queue: async (companyId: string, limit = 50) => {
      const pendingStatuses = ["draft", "validated", "transmitted", "rejected", "denied", "error"];
      const rows = await db
        .select()
        .from(fiscalDocuments)
        .where(
          and(
            eq(fiscalDocuments.companyId, companyId),
            sql`${fiscalDocuments.status} in (${sql.join(pendingStatuses.map((s) => sql`${s}`), sql`, `)})`,
          ),
        )
        .orderBy(desc(fiscalDocuments.updatedAt))
        .limit(limit);

      const counts = await db
        .select({
          status: fiscalDocuments.status,
          count: sql<number>`count(*)::int`,
        })
        .from(fiscalDocuments)
        .where(eq(fiscalDocuments.companyId, companyId))
        .groupBy(fiscalDocuments.status);

      return {
        documents: rows,
        counts: Object.fromEntries(counts.map((row) => [row.status, row.count])) as Record<string, number>,
      };
    },

    handleProviderCallback: async (
      companyId: string,
      providerKey: string,
      input: FiscalProviderCallbackInput,
    ) => {
      const row = await db
        .select()
        .from(fiscalDocuments)
        .where(
          and(
            eq(fiscalDocuments.companyId, companyId),
            eq(fiscalDocuments.accessKey, input.accessKey),
            eq(fiscalDocuments.providerKey, providerKey),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Fiscal document not found for access key");

      const nextStatus = mapCallbackStatusToDocumentStatus(input.status);
      const isTerminal =
        nextStatus === "authorized" || nextStatus === "cancelled" || nextStatus === "invalidated";
      await db
        .update(fiscalDocuments)
        .set({
          status: nextStatus,
          providerDocumentId: input.providerDocumentId ?? row.providerDocumentId,
          protocol: input.protocol ?? row.protocol,
          errorMessage:
            nextStatus === "error" || nextStatus === "rejected" || nextStatus === "denied"
              ? input.message ?? null
              : null,
          authorizedAt: nextStatus === "authorized" ? new Date() : row.authorizedAt,
          cancelledAt: nextStatus === "cancelled" ? new Date() : row.cancelledAt,
          updatedAt: new Date(),
        })
        .where(and(eq(fiscalDocuments.id, row.id), eq(fiscalDocuments.companyId, companyId)));

      await insertEvent({
        companyId,
        fiscalDocumentId: row.id,
        kind: input.eventKind === "cc-e" ? "cc-e" : nextStatus,
        actor: { actorType: "system", actorId: `provider:${providerKey}`, agentId: null, runId: null },
        providerEventKind: input.eventKind ?? null,
        payload: {
          providerKey,
          status: nextStatus,
          protocol: input.protocol ?? null,
          message: input.message ?? null,
        },
      });

      publishLiveEvent({
        companyId,
        type: "fiscal.document.callback_received",
        payload: {
          documentId: row.id,
          accessKey: row.accessKey,
          status: nextStatus,
          providerKey,
        },
      });
      publishStatusChanged({
        companyId,
        document: { id: row.id, model: row.model, accessKey: row.accessKey, status: nextStatus },
        providerKey,
      });

      return {
        document: await loadDetail(companyId, row.id),
        callbackStatus: nextStatus,
        terminal: isTerminal,
      };
    },

    fetchInboundDocument: async (
      companyId: string,
      accessKey: string,
      model: FiscalDocumentModel,
    ) => {
      const binding = await resolveBinding(companyId, model);
      const providerConfig = await resolveProviderConfig(binding, companyId);
      const provider = getFiscalProviderFactory(binding.providerKey)(providerConfig);
      if (!provider.capabilities.fetchByAccessKey) {
        throw unprocessable(`Fiscal provider "${binding.providerKey}" cannot fetch external documents`);
      }
      const request: FiscalFetchRequest = {
        companyId,
        accessKey,
        model,
        environment: providerConfig.environment,
      };
      const result = await provider.fetchByAccessKey(request);

      return result;
    },

    confirmInbound: async (companyId: string, fiscalDocumentId: string, actor: FiscalActor) => {
      const doc = await assertBelongsToCompany(fiscalDocuments, fiscalDocumentId, companyId, "Fiscal document");
      if (doc.operationDirection !== "inbound") {
        throw conflict("Only inbound documents can be confirmed as received");
      }
      if (!["draft", "validated", "authorized"].includes(doc.status)) {
        throw conflict(`Inbound document cannot be confirmed from status "${doc.status}"`);
      }

      const taxes = await loadTaxes(companyId, fiscalDocumentId);
      const finance = financeService(db);
      const credits: Array<{ taxType: string; amountCents: number; financeEventId: string }> = [];
      for (const tax of taxes) {
        if (!tax.creditable || tax.amountCents <= 0) continue;
        const event = await finance.createEvent(companyId, {
          agentId: null,
          issueId: doc.issueId,
          projectId: null,
          goalId: null,
          heartbeatRunId: null,
          costEventId: null,
          billingCode: null,
          description: `Crédito fiscal ${tax.taxType} — ${doc.accessKey}`,
          eventKind: "fiscal_tax_credit",
          direction: "credit",
          biller: "fiscal",
          provider: doc.providerKey,
          amountCents: tax.amountCents,
          currency: "BRL",
          estimated: false,
          occurredAt: new Date(),
          metadataJson: {
            fiscalDocumentId: doc.id,
            accessKey: doc.accessKey,
            taxType: tax.taxType,
          },
        });
        credits.push({ taxType: tax.taxType, amountCents: tax.amountCents, financeEventId: event.id });
      }

      await db
        .update(fiscalDocuments)
        .set({ status: "validated", errorMessage: null, updatedAt: new Date() })
        .where(and(eq(fiscalDocuments.id, fiscalDocumentId), eq(fiscalDocuments.companyId, companyId)));

      await insertEvent({
        companyId,
        fiscalDocumentId,
        kind: "validated",
        actor,
        payload: { confirmed: true, creditCount: credits.length, creditCents: credits.reduce((sum, c) => sum + c.amountCents, 0) },
      });

      publishStatusChanged({
        companyId,
        document: { id: doc.id, model: doc.model, accessKey: doc.accessKey, status: "validated" },
        providerKey: doc.providerKey,
      });

      return { document: await loadDetail(companyId, fiscalDocumentId), credits };
    },

    manifest: async (
      companyId: string,
      fiscalDocumentId: string,
      kind: FiscalManifestationKind,
      justification: string | null,
      actor: FiscalActor,
    ) => {
      const doc = await assertBelongsToCompany(fiscalDocuments, fiscalDocumentId, companyId, "Fiscal document");
      if (doc.operationDirection !== "inbound") {
        throw conflict("Only inbound documents accept manifestação do destinatário");
      }

      let providerResult: { status: "ok" | "error"; message?: string | null } | null = null;
      if (doc.providerKey) {
        const binding = await resolveBinding(companyId, doc.model as FiscalDocumentModel);
        const providerConfig = await resolveProviderConfig(binding, companyId);
        const provider = getFiscalProviderFactory(binding.providerKey)(providerConfig);
        if (provider.capabilities.manifestation) {
          providerResult = await provider.manifest({
            companyId,
            accessKey: doc.accessKey,
            kind,
            justification,
            environment: providerConfig.environment,
          });
          if (providerResult.status === "error") {
            throw conflict(providerResult.message ?? "Provider did not confirm manifestation");
          }
        }
      }

      await insertEvent({
        companyId,
        fiscalDocumentId,
        kind: "manifestation",
        actor,
        payload: { kind, justification: justification ?? null, providerStatus: providerResult?.status ?? "local" },
      });

      publishLiveEvent({
        companyId,
        type: "fiscal.document.callback_received",
        payload: { documentId: doc.id, accessKey: doc.accessKey, status: doc.status, kind },
      });

      return { document: await loadDetail(companyId, fiscalDocumentId), providerResult };
    },

    download: async (companyId: string, fiscalDocumentId: string, kind: "xml" | "danfe") => {
      const doc = await assertBelongsToCompany(fiscalDocuments, fiscalDocumentId, companyId, "Fiscal document");
      if (!doc.providerKey || !doc.providerDocumentId) {
        throw conflict("Fiscal document has no provider reference to download");
      }
      const binding = await resolveBinding(companyId, doc.model as FiscalDocumentModel);
      const providerConfig = await resolveProviderConfig(binding, companyId);
      const provider = getFiscalProviderFactory(binding.providerKey)(providerConfig);
      const request = {
        companyId,
        documentId: doc.id,
        providerDocumentId: doc.providerDocumentId,
        accessKey: doc.accessKey,
        environment: providerConfig.environment,
      };
      return kind === "xml"
        ? provider.downloadXml(request)
        : provider.downloadDanfe(request);
    },

    persistDocumentFiles: async (
      companyId: string,
      fiscalDocumentId: string,
      actor: FiscalActor,
    ) => {
      const doc = await assertBelongsToCompany(fiscalDocuments, fiscalDocumentId, companyId, "Fiscal document");
      if (!doc.providerKey || !doc.providerDocumentId) {
        throw conflict("Fiscal document has no provider reference to download");
      }
      if (!deps.persistFile) {
        throw unprocessable("File persistence is not wired for this deployment");
      }
      const binding = await resolveBinding(companyId, doc.model as FiscalDocumentModel);
      const providerConfig = await resolveProviderConfig(binding, companyId);
      const provider = getFiscalProviderFactory(binding.providerKey)(providerConfig);
      const request = {
        companyId,
        documentId: doc.id,
        providerDocumentId: doc.providerDocumentId,
        accessKey: doc.accessKey,
        environment: providerConfig.environment,
      };

      const persisted: Array<{ kind: "xml" | "danfe"; assetId: string; byteSize: number }> = [];
      if (!doc.xmlAssetId) {
        const xml = await provider.downloadXml(request);
        const assetId = await deps.persistFile({
          companyId,
          filename: `${doc.accessKey}.xml`,
          contentType: xml.contentType,
          body: Buffer.from(xml.content),
          actor,
        });
        if (assetId) {
          await db
            .update(fiscalDocuments)
            .set({ xmlAssetId: assetId, updatedAt: new Date() })
            .where(and(eq(fiscalDocuments.id, fiscalDocumentId), eq(fiscalDocuments.companyId, companyId)));
          persisted.push({ kind: "xml", assetId, byteSize: xml.content.byteLength });
        }
      }

      if (!doc.danfeAssetId && provider.capabilities.danfe) {
        const danfe = await provider.downloadDanfe(request);
        const assetId = await deps.persistFile({
          companyId,
          filename: `${doc.accessKey}-danfe.pdf`,
          contentType: danfe.contentType,
          body: Buffer.from(danfe.content),
          actor,
        });
        if (assetId) {
          await db
            .update(fiscalDocuments)
            .set({ danfeAssetId: assetId, updatedAt: new Date() })
            .where(and(eq(fiscalDocuments.id, fiscalDocumentId), eq(fiscalDocuments.companyId, companyId)));
          persisted.push({ kind: "danfe", assetId, byteSize: danfe.content.byteLength });
        }
      }

      await insertEvent({
        companyId,
        fiscalDocumentId,
        kind: "provider_callback",
        actor,
        providerEventKind: "files_persisted",
        payload: { persisted },
      });

      return { document: await loadDetail(companyId, fiscalDocumentId), persisted };
    },

    listEvents: async (companyId: string, fiscalDocumentId: string) => {
      await assertBelongsToCompany(fiscalDocuments, fiscalDocumentId, companyId, "Fiscal document");
      return db
        .select()
        .from(fiscalEvents)
        .where(
          and(
            eq(fiscalEvents.companyId, companyId),
            eq(fiscalEvents.fiscalDocumentId, fiscalDocumentId),
          ),
        )
        .orderBy(desc(fiscalEvents.createdAt));
    },
  };
}
