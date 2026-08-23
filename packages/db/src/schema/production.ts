import { index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { erpProducts } from "./master_data.js";

/**
 * PCP (Planejamento e Controle da Produção) — Paperclip ERP.
 *
 * Production orders carry a finished product, a planned quantity and a bill
 * of materials (order items = raw materials). Completing an order consumes
 * the materials and produces the finished good through inventory movements,
 * keeping stock consistent and audited.
 */

export const erpProductionOrders = pgTable(
  "erp_production_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    productId: uuid("product_id").notNull().references(() => erpProducts.id, { onDelete: "cascade" }),
    plannedQuantity: numeric("planned_quantity", { precision: 14, scale: 4 }).notNull(),
    status: text("status").notNull().default("planned"),
    notes: text("notes"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCodeUq: uniqueIndex("erp_production_orders_company_code_uq").on(table.companyId, table.code),
    companyStatusIdx: index("erp_production_orders_company_status_idx").on(table.companyId, table.status),
    productIdx: index("erp_production_orders_product_idx").on(table.productId),
  }),
);

export const erpProductionOrderItems = pgTable(
  "erp_production_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    productionOrderId: uuid("production_order_id").notNull().references(() => erpProductionOrders.id, {
      onDelete: "cascade",
    }),
    productId: uuid("product_id").notNull().references(() => erpProducts.id, { onDelete: "cascade" }),
    plannedQuantity: numeric("planned_quantity", { precision: 14, scale: 4 }).notNull(),
    unitCostCents: integer("unit_cost_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOrderIdx: index("erp_production_order_items_company_order_idx").on(
      table.companyId,
      table.productionOrderId,
    ),
    productIdx: index("erp_production_order_items_product_idx").on(table.productId),
  }),
);
