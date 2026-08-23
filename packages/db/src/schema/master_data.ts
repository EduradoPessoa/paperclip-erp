import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * ERP master data — Paperclip ERP.
 *
 * Company-scoped master entities shared by the modules: customers, suppliers,
 * products and the chart of accounts. Codes are unique per company; status
 * controls active/inactive/blocked without hard deletes.
 */

const masterTimestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const erpCustomers = pgTable(
  "erp_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    taxId: text("tax_id").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text("created_by_user_id"),
    ...masterTimestamps,
  },
  (table) => ({
    companyCodeUq: uniqueIndex("erp_customers_company_code_uq").on(table.companyId, table.code),
    companyTaxUq: uniqueIndex("erp_customers_company_tax_uq").on(table.companyId, table.taxId),
    companyStatusIdx: index("erp_customers_company_status_idx").on(table.companyId, table.status),
  }),
);

export const erpSuppliers = pgTable(
  "erp_suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    taxId: text("tax_id").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text("created_by_user_id"),
    ...masterTimestamps,
  },
  (table) => ({
    companyCodeUq: uniqueIndex("erp_suppliers_company_code_uq").on(table.companyId, table.code),
    companyTaxUq: uniqueIndex("erp_suppliers_company_tax_uq").on(table.companyId, table.taxId),
    companyStatusIdx: index("erp_suppliers_company_status_idx").on(table.companyId, table.status),
  }),
);

export const erpProducts = pgTable(
  "erp_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    ncm: text("ncm"),
    cest: text("cest"),
    unit: text("unit").notNull().default("UN"),
    priceCents: integer("price_cents"),
    costCents: integer("cost_cents"),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text("created_by_user_id"),
    ...masterTimestamps,
  },
  (table) => ({
    companyCodeUq: uniqueIndex("erp_products_company_code_uq").on(table.companyId, table.code),
    companyStatusIdx: index("erp_products_company_status_idx").on(table.companyId, table.status),
    companyNcmIdx: index("erp_products_company_ncm_idx").on(table.companyId, table.ncm),
  }),
);

export const erpChartOfAccounts = pgTable(
  "erp_chart_of_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    accountType: text("account_type").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => erpChartOfAccounts.id, { onDelete: "set null" }),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text("created_by_user_id"),
    ...masterTimestamps,
  },
  (table) => ({
    companyCodeUq: uniqueIndex("erp_chart_of_accounts_company_code_uq").on(table.companyId, table.code),
    companyStatusIdx: index("erp_chart_of_accounts_company_status_idx").on(table.companyId, table.status),
    parentIdx: index("erp_chart_of_accounts_parent_idx").on(table.parentId),
  }),
);
