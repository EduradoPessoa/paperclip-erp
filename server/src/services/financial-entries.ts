/**
 * Financial entries service — contas a pagar/receber (Paperclip ERP).
 *
 * Company-scoped AP/AR with settlement: settling an open entry posts a
 * `finance_event` to the ledger (payable → debit/cash out; receivable →
 * credit/cash in) and marks the entry paid.
 */

import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { erpPayables, erpReceivables } from "@paperclipai/db";
import type {
  CreateErpPayable,
  CreateErpReceivable,
  SettleFinancialEntry,
  UpdateErpPayable,
  UpdateErpReceivable,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { financeService } from "./finance.js";

export interface FinancialEntryListOptions {
  status?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

function entryConditions(table: any, companyId: string, options: FinancialEntryListOptions) {
  const conditions: any[] = [eq(table.companyId, companyId)];
  if (options.status) conditions.push(eq(table.status, options.status));
  if (options.from) conditions.push(gte(table.dueDate, new Date(options.from)));
  if (options.to) conditions.push(lte(table.dueDate, new Date(options.to)));
  return conditions;
}

async function assertLinkedBelongsToCompany(
  db: Db,
  table: any,
  id: string | null | undefined,
  companyId: string,
  label: string,
) {
  if (!id) return;
  const row = await db.select().from(table).where(eq(table.id, id)).then((rows: any[]) => rows[0] ?? null);
  if (!row) throw notFound(`${label} not found`);
  if (row.companyId !== companyId) throw unprocessable(`${label} does not belong to company`);
}

export function financialEntriesService(db: Db) {
  return {
    // --- Payables ---
    listPayables: async (companyId: string, options: FinancialEntryListOptions) =>
      db
        .select()
        .from(erpPayables)
        .where(and(...entryConditions(erpPayables, companyId, options)))
        .orderBy(asc(erpPayables.dueDate))
        .limit(options.limit)
        .offset(options.offset),

    getPayable: async (companyId: string, id: string) => {
      const row = await db
        .select()
        .from(erpPayables)
        .where(and(eq(erpPayables.id, id), eq(erpPayables.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Payable not found");
      return row;
    },

    createPayable: async (companyId: string, input: CreateErpPayable, userId: string | null) => {
      const { erpSuppliers, fiscalDocuments } = await import("@paperclipai/db");
      await assertLinkedBelongsToCompany(db, erpSuppliers, input.supplierId, companyId, "Supplier");
      await assertLinkedBelongsToCompany(db, fiscalDocuments, input.fiscalDocumentId, companyId, "Fiscal document");
      return db
        .insert(erpPayables)
        .values({
          companyId,
          supplierId: input.supplierId ?? null,
          fiscalDocumentId: input.fiscalDocumentId ?? null,
          description: input.description,
          amountCents: input.amountCents,
          currency: input.currency ?? "BRL",
          dueDate: new Date(input.dueDate),
          paymentMethod: input.paymentMethod ?? null,
          metadata: input.metadata ?? {},
          createdByUserId: userId,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    updatePayable: async (companyId: string, id: string, input: UpdateErpPayable) => {
      const existing = await db.select().from(erpPayables).where(and(eq(erpPayables.id, id), eq(erpPayables.companyId, companyId))).limit(1).then((rows) => rows[0] ?? null);
      if (!existing) throw notFound("Payable not found");
      if (existing.status !== "open") throw conflict("Only open payables can be updated");
      const [row] = await db
        .update(erpPayables)
        .set({
          ...input,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          updatedAt: new Date(),
        })
        .where(and(eq(erpPayables.id, id), eq(erpPayables.companyId, companyId)))
        .returning();
      return row;
    },

    settlePayable: async (
      companyId: string,
      id: string,
      input: SettleFinancialEntry,
      actor: { actorType: string; actorId: string },
    ) => {
      const entry = await db.select().from(erpPayables).where(and(eq(erpPayables.id, id), eq(erpPayables.companyId, companyId))).limit(1).then((rows) => rows[0] ?? null);
      if (!entry) throw notFound("Payable not found");
      if (entry.status !== "open") throw conflict("Payable is not open");
      const finance = financeService(db);
      const event = await finance.createEvent(companyId, {
        agentId: null,
        issueId: null,
        projectId: null,
        goalId: null,
        heartbeatRunId: null,
        costEventId: null,
        billingCode: null,
        description: `Pagamento — ${entry.description}`,
        eventKind: "payable_settlement",
        direction: "debit",
        biller: "erp:payables",
        amountCents: input.paidAmountCents,
        currency: entry.currency,
        estimated: false,
        occurredAt: new Date(),
        metadataJson: { payableId: entry.id, supplierId: entry.supplierId },
      });
      const [row] = await db
        .update(erpPayables)
        .set({
          status: "paid",
          paidAt: new Date(),
          paidAmountCents: input.paidAmountCents,
          paymentMethod: input.paymentMethod ?? entry.paymentMethod,
          updatedAt: new Date(),
        })
        .where(and(eq(erpPayables.id, id), eq(erpPayables.companyId, companyId)))
        .returning();
      return { entry: row, financeEvent: event };
    },

    // --- Receivables ---
    listReceivables: async (companyId: string, options: FinancialEntryListOptions) =>
      db
        .select()
        .from(erpReceivables)
        .where(and(...entryConditions(erpReceivables, companyId, options)))
        .orderBy(asc(erpReceivables.dueDate))
        .limit(options.limit)
        .offset(options.offset),

    getReceivable: async (companyId: string, id: string) => {
      const row = await db
        .select()
        .from(erpReceivables)
        .where(and(eq(erpReceivables.id, id), eq(erpReceivables.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Receivable not found");
      return row;
    },

    createReceivable: async (companyId: string, input: CreateErpReceivable, userId: string | null) => {
      const { erpCustomers, fiscalDocuments } = await import("@paperclipai/db");
      await assertLinkedBelongsToCompany(db, erpCustomers, input.customerId, companyId, "Customer");
      await assertLinkedBelongsToCompany(db, fiscalDocuments, input.fiscalDocumentId, companyId, "Fiscal document");
      return db
        .insert(erpReceivables)
        .values({
          companyId,
          customerId: input.customerId ?? null,
          fiscalDocumentId: input.fiscalDocumentId ?? null,
          description: input.description,
          amountCents: input.amountCents,
          currency: input.currency ?? "BRL",
          dueDate: new Date(input.dueDate),
          paymentMethod: input.paymentMethod ?? null,
          metadata: input.metadata ?? {},
          createdByUserId: userId,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    updateReceivable: async (companyId: string, id: string, input: UpdateErpReceivable) => {
      const existing = await db.select().from(erpReceivables).where(and(eq(erpReceivables.id, id), eq(erpReceivables.companyId, companyId))).limit(1).then((rows) => rows[0] ?? null);
      if (!existing) throw notFound("Receivable not found");
      if (existing.status !== "open") throw conflict("Only open receivables can be updated");
      const [row] = await db
        .update(erpReceivables)
        .set({
          ...input,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          updatedAt: new Date(),
        })
        .where(and(eq(erpReceivables.id, id), eq(erpReceivables.companyId, companyId)))
        .returning();
      return row;
    },

    settleReceivable: async (
      companyId: string,
      id: string,
      input: SettleFinancialEntry,
      actor: { actorType: string; actorId: string },
    ) => {
      const entry = await db.select().from(erpReceivables).where(and(eq(erpReceivables.id, id), eq(erpReceivables.companyId, companyId))).limit(1).then((rows) => rows[0] ?? null);
      if (!entry) throw notFound("Receivable not found");
      if (entry.status !== "open") throw conflict("Receivable is not open");
      const finance = financeService(db);
      const event = await finance.createEvent(companyId, {
        agentId: null,
        issueId: null,
        projectId: null,
        goalId: null,
        heartbeatRunId: null,
        costEventId: null,
        billingCode: null,
        description: `Recebimento — ${entry.description}`,
        eventKind: "receivable_settlement",
        direction: "credit",
        biller: "erp:receivables",
        amountCents: input.paidAmountCents,
        currency: entry.currency,
        estimated: false,
        occurredAt: new Date(),
        metadataJson: { receivableId: entry.id, customerId: entry.customerId },
      });
      const [row] = await db
        .update(erpReceivables)
        .set({
          status: "paid",
          paidAt: new Date(),
          paidAmountCents: input.paidAmountCents,
          paymentMethod: input.paymentMethod ?? entry.paymentMethod,
          updatedAt: new Date(),
        })
        .where(and(eq(erpReceivables.id, id), eq(erpReceivables.companyId, companyId)))
        .returning();
      return { entry: row, financeEvent: event };
    },
  };
}
