import { index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { erpCustomers } from "./master_data.js";
import { erpProducts } from "./master_data.js";

/**
 * Exportação — Paperclip ERP.
 *
 * Export orders carry the export declaration, incoterm and currency.
 * Shipping the order bills the customer (receivable in the order currency).
 */

export const erpExportOrders = pgTable(
  "erp_export_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    customerId: uuid("customer_id").notNull().references(() => erpCustomers.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("draft"),
    documentNumber: text("document_number"),
    documentDate: timestamp("document_date", { withTimezone: true }),
    incoterm: text("incoterm"),
    currency: text("currency").notNull().default("USD"),
    exchangeRateBps: integer("exchange_rate_bps"),
    totalValueCents: integer("total_value_cents"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCodeUq: uniqueIndex("erp_export_orders_company_code_uq").on(table.companyId, table.code),
    companyStatusIdx: index("erp_export_orders_company_status_idx").on(table.companyId, table.status),
    customerIdx: index("erp_export_orders_customer_idx").on(table.customerId),
  }),
);

export const erpExportOrderItems = pgTable(
  "erp_export_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    exportOrderId: uuid("export_order_id").notNull().references(() => erpExportOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => erpProducts.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOrderIdx: index("erp_export_order_items_company_order_idx").on(table.companyId, table.exportOrderId),
    orderPositionUq: uniqueIndex("erp_export_order_items_order_position_uq").on(table.exportOrderId, table.position),
  }),
);
