/**
 * Fiscal routes — Paperclip ERP.
 *
 * F1 access model: reads require any authenticated actor with company access
 * (company-scoped visibility); mutations (create/transmit/consult/cancel and
 * provider bindings) require board access — agent execution paths arrive with
 * the module skills in a later phase, always through the human-in-the-loop
 * protocol.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  cancelFiscalDocumentSchema,
  createFiscalDocumentSchema,
  fiscalInboundLookupSchema,
  fiscalManifestationSchema,
  fiscalProviderBindingSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { assetService, fiscalService, logActivity, secretService } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { registerBuiltinFiscalProviders } from "../fiscal/index.js";
import { badRequest, forbidden, unauthorized } from "../errors.js";
import type { StorageService } from "../storage/types.js";
import type { FiscalActor } from "../services/fiscal.js";

registerBuiltinFiscalProviders();

function parseLimit(raw: unknown, fallback = 100) {
  if (raw == null || raw === "") return fallback;
  const limit = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 500) {
    throw badRequest("invalid 'limit' value");
  }
  return limit;
}

function parseOffset(raw: unknown) {
  if (raw == null || raw === "") return 0;
  const offset = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(offset) || offset < 0) throw badRequest("invalid 'offset' value");
  return offset;
}

function toFiscalActor(actor: ReturnType<typeof getActorInfo>): FiscalActor {
  return {
    actorType: actor.actorType,
    actorId: actor.actorId,
    agentId: actor.agentId,
    runId: actor.runId,
  };
}

function tokensEqual(a: string, b: string): boolean {
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

export function fiscalRoutes(db: Db, options: { storageService?: StorageService } = {}) {
  const router = Router();
  const secrets = secretService(db);
  const assets = assetService(db);
  const fiscal = fiscalService(db, {
    resolveCompanySecret: async (companyId: string, name: string) => {
      const secret = await secrets.getByName(companyId, name);
      if (!secret) return null;
      return secrets.resolveSecretValue(companyId, secret.id, "latest");
    },
    persistFile: options.storageService
      ? async (input) => {
          const put = await options.storageService!.putFile({
            companyId: input.companyId,
            namespace: "fiscal",
            originalFilename: input.filename,
            contentType: input.contentType,
            body: input.body,
          });
          const asset = await assets.create(input.companyId, {
            provider: put.provider,
            objectKey: put.objectKey,
            contentType: put.contentType,
            byteSize: put.byteSize,
            sha256: put.sha256,
            originalFilename: put.originalFilename,
            createdByUserId: input.actor.actorType === "user" ? input.actor.actorId : null,
            createdByAgentId: input.actor.actorType === "agent" ? input.actor.agentId : null,
          });
          return asset.id;
        }
      : undefined,
  });

  router.post(
    "/companies/:companyId/fiscal/documents",
    validate(createFiscalDocumentSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const detail = await fiscal.createDraft(companyId, req.body, toFiscalActor(actor));
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "fiscal.document_created",
        entityType: "fiscal_document",
        entityId: detail.document.id,
        details: {
          model: detail.document.model,
          accessKey: detail.document.accessKey,
          status: detail.document.status,
        },
      });
      res.status(201).json(detail);
    },
  );

  router.get("/companies/:companyId/fiscal/documents", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const model = typeof req.query.model === "string" ? req.query.model : undefined;
    const rows = await fiscal.list(companyId, {
      status,
      model,
      limit: parseLimit(req.query.limit),
      offset: parseOffset(req.query.offset),
    });
    res.json(rows);
  });

  router.get("/companies/:companyId/fiscal/documents/:documentId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    const detail = await fiscal.getDetail(companyId, req.params.documentId as string);
    res.json(detail);
  });

  router.get("/companies/:companyId/fiscal/documents/:documentId/events", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    const events = await fiscal.listEvents(companyId, req.params.documentId as string);
    res.json(events);
  });

  router.post(
    "/companies/:companyId/fiscal/documents/:documentId/transmit",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await fiscal.transmit(companyId, req.params.documentId as string, toFiscalActor(actor));
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "fiscal.document_transmitted",
        entityType: "fiscal_document",
        entityId: result.document.document.id,
        details: {
          status: result.document.document.status,
          providerKey: result.document.document.providerKey,
          providerResult: result.providerResult.status,
        },
      });
      res.json(result);
    },
  );

  router.post(
    "/companies/:companyId/fiscal/documents/:documentId/consult",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await fiscal.consult(companyId, req.params.documentId as string, toFiscalActor(actor));
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "fiscal.document_consulted",
        entityType: "fiscal_document",
        entityId: result.document.document.id,
        details: { status: result.document.document.status },
      });
      res.json(result);
    },
  );

  router.post(
    "/companies/:companyId/fiscal/documents/:documentId/cancel",
    validate(cancelFiscalDocumentSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await fiscal.cancel(
        companyId,
        req.params.documentId as string,
        req.body.justification,
        toFiscalActor(actor),
      );
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "fiscal.document_cancelled",
        entityType: "fiscal_document",
        entityId: result.document.document.id,
        details: { status: result.document.document.status },
      });
      res.json(result);
    },
  );

  router.get("/companies/:companyId/fiscal/provider-bindings", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await fiscal.listBindings(companyId));
  });

  router.put(
    "/companies/:companyId/fiscal/provider-bindings",
    validate(fiscalProviderBindingSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const binding = await fiscal.upsertBinding(companyId, req.body, toFiscalActor(actor));
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "fiscal.provider_binding_upserted",
        entityType: "fiscal_provider_binding",
        entityId: binding.id,
        details: { providerKey: binding.providerKey, enabled: binding.enabled },
      });
      res.json(binding);
    },
  );

  router.get("/companies/:companyId/fiscal/queue", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    const queue = await fiscal.queue(companyId, parseLimit(req.query.limit, 50));
    res.json(queue);
  });

  router.get("/companies/:companyId/fiscal/documents/:documentId/xml", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const file = await fiscal.download(companyId, req.params.documentId as string, "xml");
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(Buffer.from(file.content));
  });

  router.get("/companies/:companyId/fiscal/documents/:documentId/danfe", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const file = await fiscal.download(companyId, req.params.documentId as string, "danfe");
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
    res.send(Buffer.from(file.content));
  });

  router.post(
    "/companies/:companyId/fiscal/inbound/lookup",
    validate(fiscalInboundLookupSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await fiscal.fetchInboundDocument(companyId, req.body.accessKey, req.body.model);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "fiscal.inbound_lookup",
        entityType: "fiscal_document",
        entityId: req.body.accessKey,
        details: { accessKey: req.body.accessKey, model: req.body.model, status: result.status },
      });
      res.json(result);
    },
  );

  router.post("/companies/:companyId/fiscal/documents/:documentId/confirm-inbound", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await fiscal.confirmInbound(companyId, req.params.documentId as string, toFiscalActor(actor));
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "fiscal.inbound_confirmed",
      entityType: "fiscal_document",
      entityId: result.document.document.id,
      details: { creditCount: result.credits.length, creditCents: result.credits.reduce((s, c) => s + c.amountCents, 0) },
    });
    res.json(result);
  });

  router.post(
    "/companies/:companyId/fiscal/documents/:documentId/manifestation",
    validate(fiscalManifestationSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await fiscal.manifest(
        companyId,
        req.params.documentId as string,
        req.body.kind,
        req.body.justification ?? null,
        toFiscalActor(actor),
      );
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "fiscal.manifestation",
        entityType: "fiscal_document",
        entityId: result.document.document.id,
        details: { kind: req.body.kind },
      });
      res.json(result);
    },
  );

  router.post("/companies/:companyId/fiscal/documents/:documentId/persist-files", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await fiscal.persistDocumentFiles(companyId, req.params.documentId as string, toFiscalActor(actor));
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "fiscal.document_files_persisted",
      entityType: "fiscal_document",
      entityId: result.document.document.id,
      details: { persisted: result.persisted },
    });
    res.json(result);
  });

  /**
   * Provider webhook endpoint (F2). Called by the fiscal integrator with
   * status callbacks; authenticated by a per-binding webhook token, not a
   * session. The callback is audited as a system actor and published on the
   * company live-events channel.
   */
  router.post("/companies/:companyId/fiscal/webhooks/:providerKey", async (req, res) => {
    const companyId = req.params.companyId as string;
    const providerKey = req.params.providerKey as string;

    const bindings = await fiscal.listBindings(companyId);
    const binding = bindings.find((row) => row.providerKey === providerKey && row.enabled);
    if (!binding) throw forbidden("Fiscal provider binding not found or disabled");

    const extra = (binding.config.extra ?? {}) as Record<string, unknown>;
    const webhookToken = typeof extra.webhookToken === "string" ? extra.webhookToken : undefined;
    if (!webhookToken) throw unauthorized("Fiscal provider webhook is not configured with a token");

    const supplied =
      typeof req.header("x-webhook-token") === "string"
        ? (req.header("x-webhook-token") as string)
        : typeof req.body?.token === "string"
          ? req.body.token
          : null;
    if (!supplied || !tokensEqual(supplied, webhookToken)) {
      throw unauthorized("Invalid fiscal provider webhook token");
    }

    const accessKey = typeof req.body?.accessKey === "string" ? req.body.accessKey : null;
    const status = typeof req.body?.status === "string" ? req.body.status : null;
    if (!accessKey || !status) throw badRequest("Webhook payload requires accessKey and status");

    const result = await fiscal.handleProviderCallback(companyId, providerKey, {
      accessKey,
      status,
      protocol: typeof req.body?.protocol === "string" ? req.body.protocol : null,
      message: typeof req.body?.message === "string" ? req.body.message : null,
      eventKind: typeof req.body?.eventKind === "string" ? req.body.eventKind : null,
      providerDocumentId: typeof req.body?.providerDocumentId === "string" ? req.body.providerDocumentId : null,
    });

    await logActivity(db, {
      companyId,
      actorType: "system",
      actorId: `provider:${providerKey}`,
      agentId: null,
      action: "fiscal.document_callback",
      entityType: "fiscal_document",
      entityId: result.document.document.id,
      details: { status: result.callbackStatus, providerKey, terminal: result.terminal },
    });

    res.json({ ok: true, documentId: result.document.document.id, status: result.callbackStatus });
  });

  return router;
}
