import { index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { erpCustomers } from "./master_data.js";
import { erpProducts } from "./master_data.js";

/**
 * OMS (Order Management) — Paperclip ERP.
 *
 * Multi-channel order consolidation: channel + external order id, delivery
 * promise and lifecycle (received → confirmed → shipped → delivered /
 * cancelled). Confirming an order with a customer creates the sales order so
 * billing/fiscal flow continues in Vendas.
 */

export const erpOmsOrders = pgTable(
  "erp_oms_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    channel: text("channel").notNull(),
    externalOrderId: text("external_order_id"),
    customerId: uuid("customer_id").references(() => erpCustomers.id, { onDelete: "set null" }),
    salesOrderCaseId: uuid("sales_order_case_id"),
    status: text("status").notNull().default("received"),
    promiseAt: timestamp("promise_at", { withTimezone: true }),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCodeUq: uniqueIndex("erp_oms_orders_company_code_uq").on(table.companyId, table.code),
    companyChannelIdx: index("erp_oms_orders_company_channel_idx").on(table.companyId, table.channel),
    companyStatusIdx: index("erp_oms_orders_company_status_idx").on(table.companyId, table.status),
  }),
);

export const erpOmsOrderItems = pgTable(
  "erp_oms_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    omsOrderId: uuid("oms_order_id").notNull().references(() => erpOmsOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => erpProducts.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOrderIdx: index("erp_oms_order_items_company_order_idx").on(table.companyId, table.omsOrderId),
    orderPositionUq: uniqueIndex("erp_oms_order_items_order_position_uq").on(table.omsOrderId, table.position),
  }),
);
