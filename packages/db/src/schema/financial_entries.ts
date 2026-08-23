import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { erpCustomers } from "./master_data.js";
import { erpSuppliers } from "./master_data.js";
import { fiscalDocuments } from "./fiscal.js";

/**
 * Financeiro base — contas a pagar (payables) e contas a receber
 * (receivables). Company-scoped; origin documents (fiscal) and parties
 * (customer/supplier) are linked by reference. Settlement posts a
 * `finance_event` to the ledger.
 */

const entryColumns = {
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("BRL"),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("open"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paidAmountCents: integer("paid_amount_cents"),
  paymentMethod: text("payment_method"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdByUserId: text("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const erpPayables = pgTable(
  "erp_payables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id").references(() => erpSuppliers.id, { onDelete: "set null" }),
    fiscalDocumentId: uuid("fiscal_document_id").references(() => fiscalDocuments.id, { onDelete: "set null" }),
    ...entryColumns,
  },
  (table) => ({
    companyStatusIdx: index("erp_payables_company_status_idx").on(table.companyId, table.status),
    companyDueIdx: index("erp_payables_company_due_idx").on(table.companyId, table.dueDate),
    supplierIdx: index("erp_payables_supplier_idx").on(table.supplierId),
  }),
);

export const erpReceivables = pgTable(
  "erp_receivables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id").references(() => erpCustomers.id, { onDelete: "set null" }),
    fiscalDocumentId: uuid("fiscal_document_id").references(() => fiscalDocuments.id, { onDelete: "set null" }),
    ...entryColumns,
  },
  (table) => ({
    companyStatusIdx: index("erp_receivables_company_status_idx").on(table.companyId, table.status),
    companyDueIdx: index("erp_receivables_company_due_idx").on(table.companyId, table.dueDate),
    customerIdx: index("erp_receivables_customer_idx").on(table.customerId),
  }),
);
