/**
 * Faturamento (billing) service — Paperclip ERP.
 *
 * Orchestrates outbound fiscal emission from an approved sales order:
 * builds the NF-e/NFS-e draft (order items + customer as receiver + emitter),
 * transmits via the fiscal provider, and on authorization links the
 * receivable and moves the sales order to `invoiced`.
 */

import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  erpCustomers,
  erpProducts,
  pipelineCases,
} from "@paperclipai/db";
import {
  buildPlaceholderAccessKey,
  type CreateBillingInvoice,
  type SalesOrderFields,
} from "@paperclipai/shared";
import type { CreateFiscalDocument, FiscalPartyInput } from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";
import { fiscalService } from "./fiscal.js";
import { salesService } from "./sales.js";
import type { FiscalActor } from "./fiscal.js";

export interface BillingActor extends FiscalActor {}

export function billingService(db: Db) {
  const fiscal = fiscalService(db);
  const sales = salesService(db);

  async function loadSalesOrder(companyId: string, caseId: string) {
    const row = await db
      .select()
      .from(pipelineCases)
      .where(and(eq(pipelineCases.id, caseId), eq(pipelineCases.companyId, companyId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Sales order not found");
    return row;
  }

  async function resolveItemNcm(companyId: string, productId: string | null | undefined): Promise<string | null> {
    if (!productId) return null;
    const row = await db
      .select({ ncm: erpProducts.ncm })
      .from(erpProducts)
      .where(and(eq(erpProducts.id, productId), eq(erpProducts.companyId, companyId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    return row?.ncm ?? null;
  }

  return {
    invoiceFromSalesOrder: async (
      companyId: string,
      input: CreateBillingInvoice,
      actor: BillingActor,
    ) => {
      const order = await loadSalesOrder(companyId, input.salesOrderCaseId);
      const fields = (order.fields ?? {}) as SalesOrderFields;
      const customerId = typeof fields.customerId === "string" ? fields.customerId : null;
      if (!customerId) throw unprocessable("Sales order has no customer to invoice");

      const customer = await db
        .select()
        .from(erpCustomers)
        .where(and(eq(erpCustomers.id, customerId), eq(erpCustomers.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!customer) throw notFound("Customer not found");

      const receiver: FiscalPartyInput = {
        name: customer.name,
        taxId: customer.taxId,
        address: customer.address ?? null,
        city: customer.city ?? null,
        state: customer.state ?? null,
      };

      const items: CreateFiscalDocument["items"] = [];
      for (const item of fields.items) {
        const ncm = await resolveItemNcm(companyId, item.productId);
        items.push({
          ncm,
          cest: null,
          cfop: "5102",
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPriceCents: item.unitPriceCents,
          totalCents: item.totalCents,
          taxes: [],
        });
      }

      const totalsCents = items.reduce((sum, item) => sum + item.totalCents, 0);
      const number = input.number ?? 1;
      const accessKey = buildPlaceholderAccessKey({
        emitterTaxId: input.emitter.taxId,
        model: input.model,
        number,
        series: input.series,
      });

      const draftInput: CreateFiscalDocument = {
        model: input.model,
        operationDirection: "outbound",
        caseId: null,
        issueId: null,
        number,
        series: input.series,
        accessKey,
        emitter: input.emitter,
        receiver,
        items,
        totalsCents,
        taxes: input.taxes,
        splitPayment: null,
        providerExtras: { salesOrderCaseId: order.id },
      };

      const draft = await fiscal.createDraft(companyId, draftInput, actor);
      const transmitted = await fiscal.transmit(companyId, draft.document.id, actor);
      const document = transmitted.document.document;
      const authorized = document.status === "authorized";

      let receivable = null;
      if (authorized) {
        const invoiced = await sales.invoiceFromFiscal(companyId, order.id, document.id, {
          type: "user",
          userId: actor.actorType === "user" ? actor.actorId : null,
        });
        receivable = invoiced.receivable;
      }

      return {
        fiscalDocument: transmitted.document,
        providerResult: transmitted.providerResult,
        authorized,
        receivable,
      };
    },

    listInvoices: async (companyId: string, options: { status?: string; limit: number; offset: number }) =>
      fiscal.list(companyId, {
        status: options.status,
        model: undefined,
        direction: "outbound",
        limit: options.limit,
        offset: options.offset,
      }),

    getInvoice: (companyId: string, documentId: string) => fiscal.getDetail(companyId, documentId),
  };
}
