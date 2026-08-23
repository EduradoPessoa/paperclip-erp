/**
 * Compras (purchasing) service — Paperclip ERP.
 *
 * The purchase order is a pipeline case with typed fields (see
 * `@paperclipai/shared` erp-purchasing). This service provisions the
 * purchase-order pipeline (idempotent), creates orders from typed input,
 * lists them, and handles goods receipt: order → received + payable linked to
 * the supplier and the inbound fiscal document.
 */

import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  erpProducts,
  erpSuppliers,
  fiscalDocuments,
  pipelineCases,
  pipelines,
} from "@paperclipai/db";
import {
  PURCHASE_ORDER_PIPELINE_KEY,
  PURCHASE_ORDER_STAGES,
  purchaseOrderFieldsSchema,
  purchaseOrderTotals,
  type PurchaseOrderFields,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { pipelineService } from "./pipelines.js";
import { financialEntriesService } from "./financial-entries.js";

export interface PurchasingActor {
  type: "user" | "agent";
  userId?: string | null;
  agentId?: string | null;
  runId?: string | null;
}

export function purchasingService(db: Db) {
  const pipelinesSvc = pipelineService(db, {});
  const entries = financialEntriesService(db);

  async function getPurchaseOrderPipeline(companyId: string) {
    return db
      .select()
      .from(pipelines)
      .where(and(eq(pipelines.companyId, companyId), eq(pipelines.key, PURCHASE_ORDER_PIPELINE_KEY)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }

  async function assertSupplierInCompany(companyId: string, supplierId: string) {
    const row = await db
      .select({ id: erpSuppliers.id, companyId: erpSuppliers.companyId })
      .from(erpSuppliers)
      .where(eq(erpSuppliers.id, supplierId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Supplier not found");
    if (row.companyId !== companyId) throw unprocessable("Supplier does not belong to company");
    return row;
  }

  async function assertProductsInCompany(companyId: string, fields: PurchaseOrderFields) {
    for (const item of fields.items) {
      if (!item.productId) continue;
      const row = await db
        .select({ id: erpProducts.id, companyId: erpProducts.companyId })
        .from(erpProducts)
        .where(eq(erpProducts.id, item.productId))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound(`Product "${item.productId}" not found`);
      if (row.companyId !== companyId) throw unprocessable("Product does not belong to company");
    }
  }

  async function loadOrder(companyId: string, caseId: string) {
    const row = await db
      .select()
      .from(pipelineCases)
      .where(and(eq(pipelineCases.id, caseId), eq(pipelineCases.companyId, companyId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Purchase order not found");
    return row;
  }

  async function ensurePipelines(companyId: string, actor: PurchasingActor) {
    const existing = await getPurchaseOrderPipeline(companyId);
    if (existing) return existing;
    const created = await pipelinesSvc.createPipeline({
      companyId,
      key: PURCHASE_ORDER_PIPELINE_KEY,
      name: "Pedido de compra",
      description: "Processo de compra: rascunho → aprovação humana → enviado → recebido → fechado.",
      enforceTransitions: true,
      stages: PURCHASE_ORDER_STAGES.map((stage) => ({
        key: stage.key,
        name: stage.name,
        kind: stage.kind as never,
        config: ("config" in stage ? stage.config : undefined) as never,
      })),
      actor: actor as never,
    });
    return created;
  }

  return {
    ensurePipelines: (companyId: string, actor: PurchasingActor) => ensurePipelines(companyId, actor),

    createOrder: async (
      companyId: string,
      input: PurchaseOrderFields,
      actor: PurchasingActor,
    ) => {
      const fields = purchaseOrderFieldsSchema.parse(input);
      await assertSupplierInCompany(companyId, fields.supplierId);
      await assertProductsInCompany(companyId, fields);
      const pipeline = await ensurePipelines(companyId, actor);

      const caseKey = `PO-${Date.now().toString(36).toUpperCase()}`;
      const result = await pipelinesSvc.ingestCase({
        companyId,
        pipelineId: pipeline.id,
        caseKey,
        title: `Pedido de compra — ${fields.supplierName ?? fields.supplierId}`,
        summary: `${fields.items.length} item(ns) · ${purchaseOrderTotals(fields)} cents`,
        fields: fields as unknown as Record<string, unknown>,
        stageKey: "draft",
        actor: actor as never,
      });
      return result;
    },

    listOrders: async (companyId: string) => {
      const pipeline = await getPurchaseOrderPipeline(companyId);
      if (!pipeline) return [];
      return db
        .select()
        .from(pipelineCases)
        .where(and(eq(pipelineCases.companyId, companyId), eq(pipelineCases.pipelineId, pipeline.id)))
        .orderBy(desc(pipelineCases.createdAt));
    },

    getOrder: loadOrder,

    receiptFromFiscal: async (
      companyId: string,
      orderCaseId: string,
      fiscalDocumentId: string,
      actor: PurchasingActor,
    ) => {
      const order = await loadOrder(companyId, orderCaseId);
      const fields = (order.fields ?? {}) as PurchaseOrderFields;
      const supplierId = typeof fields.supplierId === "string" ? fields.supplierId : null;
      if (!supplierId) throw unprocessable("Purchase order has no supplier to receive against");

      const fiscal = await db
        .select()
        .from(fiscalDocuments)
        .where(and(eq(fiscalDocuments.id, fiscalDocumentId), eq(fiscalDocuments.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!fiscal) throw notFound("Fiscal document not found");
      if (fiscal.operationDirection !== "inbound") {
        throw unprocessable("Receipt requires an inbound fiscal document");
      }

      const transitioned = await pipelinesSvc.transitionCase({
        companyId,
        caseId: orderCaseId,
        toStageKey: "received",
        expectedVersion: order.version,
        reason: "Recebimento confirmado via documento fiscal de entrada",
        actor: actor as never,
      });

      const payable = await entries.createPayable(
        companyId,
        {
          supplierId,
          fiscalDocumentId: fiscal.id,
          description: `Pedido de compra ${order.caseKey} — recebimento fiscal ${fiscal.accessKey}`,
          amountCents: fiscal.totalsCents,
          currency: "BRL",
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { orderCaseId: order.id, accessKey: fiscal.accessKey },
        },
        actor.type === "user" ? actor.userId ?? null : null,
      );

      return { order: transitioned, payable };
    },
  };
}
