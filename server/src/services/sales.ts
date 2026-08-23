/**
 * Vendas (sales) service — Paperclip ERP.
 *
 * Mirrors the purchasing module: the sales order is a pipeline case with
 * typed fields. Invoicing against an outbound fiscal document moves the order
 * to `invoiced` and creates the receivable linked to the customer.
 */

import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  erpCustomers,
  erpProducts,
  fiscalDocuments,
  pipelineCases,
  pipelines,
} from "@paperclipai/db";
import {
  SALES_ORDER_PIPELINE_KEY,
  SALES_ORDER_STAGES,
  salesOrderFieldsSchema,
  salesOrderTotals,
  type SalesOrderFields,
} from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";
import { pipelineService } from "./pipelines.js";
import { financialEntriesService } from "./financial-entries.js";

export interface SalesActor {
  type: "user" | "agent";
  userId?: string | null;
  agentId?: string | null;
  runId?: string | null;
}

export function salesService(db: Db) {
  const pipelinesSvc = pipelineService(db, {});
  const entries = financialEntriesService(db);

  async function getSalesOrderPipeline(companyId: string) {
    return db
      .select()
      .from(pipelines)
      .where(and(eq(pipelines.companyId, companyId), eq(pipelines.key, SALES_ORDER_PIPELINE_KEY)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }

  async function ensurePipelines(companyId: string, actor: SalesActor) {
    const existing = await getSalesOrderPipeline(companyId);
    if (existing) return existing;
    const created = await pipelinesSvc.createPipeline({
      companyId,
      key: SALES_ORDER_PIPELINE_KEY,
      name: "Pedido de venda",
      description: "Processo de venda: rascunho → aprovação humana → confirmado → faturado → entregue.",
      enforceTransitions: true,
      stages: SALES_ORDER_STAGES.map((stage) => ({
        key: stage.key,
        name: stage.name,
        kind: stage.kind as never,
        config: ("config" in stage ? stage.config : undefined) as never,
      })),
      actor: actor as never,
    });
    return created;
  }

  async function assertCustomerInCompany(companyId: string, customerId: string) {
    const row = await db
      .select({ id: erpCustomers.id, companyId: erpCustomers.companyId })
      .from(erpCustomers)
      .where(eq(erpCustomers.id, customerId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Customer not found");
    if (row.companyId !== companyId) throw unprocessable("Customer does not belong to company");
  }

  async function assertProductsInCompany(companyId: string, fields: SalesOrderFields) {
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
    if (!row) throw notFound("Sales order not found");
    return row;
  }

  return {
    ensurePipelines: (companyId: string, actor: SalesActor) => ensurePipelines(companyId, actor),

    createOrder: async (companyId: string, input: SalesOrderFields, actor: SalesActor) => {
      const fields = salesOrderFieldsSchema.parse(input);
      await assertCustomerInCompany(companyId, fields.customerId);
      await assertProductsInCompany(companyId, fields);
      const pipeline = await ensurePipelines(companyId, actor);

      const caseKey = `SO-${Date.now().toString(36).toUpperCase()}`;
      return pipelinesSvc.ingestCase({
        companyId,
        pipelineId: pipeline.id,
        caseKey,
        title: `Pedido de venda — ${fields.customerName ?? fields.customerId}`,
        summary: `${fields.items.length} item(ns) · ${salesOrderTotals(fields)} cents`,
        fields: fields as unknown as Record<string, unknown>,
        stageKey: "draft",
        actor: actor as never,
      });
    },

    listOrders: async (companyId: string) => {
      const pipeline = await getSalesOrderPipeline(companyId);
      if (!pipeline) return [];
      return db
        .select()
        .from(pipelineCases)
        .where(and(eq(pipelineCases.companyId, companyId), eq(pipelineCases.pipelineId, pipeline.id)))
        .orderBy(desc(pipelineCases.createdAt));
    },

    getOrder: loadOrder,

    invoiceFromFiscal: async (
      companyId: string,
      orderCaseId: string,
      fiscalDocumentId: string,
      actor: SalesActor,
    ) => {
      const order = await loadOrder(companyId, orderCaseId);
      const fields = (order.fields ?? {}) as SalesOrderFields;
      const customerId = typeof fields.customerId === "string" ? fields.customerId : null;
      if (!customerId) throw unprocessable("Sales order has no customer to invoice against");

      const fiscal = await db
        .select()
        .from(fiscalDocuments)
        .where(and(eq(fiscalDocuments.id, fiscalDocumentId), eq(fiscalDocuments.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!fiscal) throw notFound("Fiscal document not found");
      if (fiscal.operationDirection !== "outbound") {
        throw unprocessable("Invoice requires an outbound fiscal document");
      }

      const transitioned = await pipelinesSvc.transitionCase({
        companyId,
        caseId: orderCaseId,
        toStageKey: "invoiced",
        expectedVersion: order.version,
        reason: "Faturamento confirmado via documento fiscal de saída",
        actor: actor as never,
      });

      const receivable = await entries.createReceivable(
        companyId,
        {
          customerId,
          fiscalDocumentId: fiscal.id,
          description: `Pedido de venda ${order.caseKey} — faturamento fiscal ${fiscal.accessKey}`,
          amountCents: fiscal.totalsCents,
          currency: "BRL",
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { orderCaseId: order.id, accessKey: fiscal.accessKey },
        },
        actor.type === "user" ? actor.userId ?? null : null,
      );

      return { order: transitioned, receivable };
    },
  };
}
