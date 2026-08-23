import { index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { erpSuppliers } from "./master_data.js";
import { erpProducts } from "./master_data.js";

/**
 * Importação — Paperclip ERP.
 *
 * Import orders carry the declaration document (DI/DUIMP), freight/insurance
 * costs and a currency reference. Clearing allocates landed costs across
 * items, updates product cost and creates the supplier payable.
 */

export const erpImportOrders = pgTable(
  "erp_import_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    supplierId: uuid("supplier_id").notNull().references(() => erpSuppliers.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("draft"),
    documentNumber: text("document_number"),
    documentDate: timestamp("document_date", { withTimezone: true }),
    arrivalDate: timestamp("arrival_date", { withTimezone: true }),
    freightCostCents: integer("freight_cost_cents").notNull().default(0),
    insuranceCostCents: integer("insurance_cost_cents").notNull().default(0),
    exchangeRateBps: integer("exchange_rate_bps"),
    totalCostCents: integer("total_cost_cents"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCodeUq: uniqueIndex("erp_import_orders_company_code_uq").on(table.companyId, table.code),
    companyStatusIdx: index("erp_import_orders_company_status_idx").on(table.companyId, table.status),
    supplierIdx: index("erp_import_orders_supplier_idx").on(table.supplierId),
  }),
);

export const erpImportOrderItems = pgTable(
  "erp_import_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    importOrderId: uuid("import_order_id").notNull().references(() => erpImportOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => erpProducts.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    invoiceValueCents: integer("invoice_value_cents").notNull().default(0),
    allocatedCostCents: integer("allocated_cost_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOrderIdx: index("erp_import_order_items_company_order_idx").on(table.companyId, table.importOrderId),
    orderPositionUq: uniqueIndex("erp_import_order_items_order_position_uq").on(table.importOrderId, table.position),
    productIdx: index("erp_import_order_items_product_idx").on(table.productId),
  }),
);
