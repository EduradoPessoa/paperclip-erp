import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { erpCustomers } from "./master_data.js";

/**
 * Serviços — Paperclip ERP.
 *
 * Service orders carry scheduling, an SLA deadline and priced items.
 * Completing an order creates the receivable (billing), keeping services
 * linked to Financeiro and later to NFS-e via the fiscal module.
 */

export const erpServiceOrders = pgTable(
  "erp_service_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    customerId: uuid("customer_id").notNull().references(() => erpCustomers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("open"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    slaDueAt: timestamp("sla_due_at", { withTimezone: true }),
    slaMet: boolean("sla_met"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCodeUq: uniqueIndex("erp_service_orders_company_code_uq").on(table.companyId, table.code),
    companyStatusIdx: index("erp_service_orders_company_status_idx").on(table.companyId, table.status),
    customerIdx: index("erp_service_orders_customer_idx").on(table.customerId),
  }),
);

export const erpServiceOrderItems = pgTable(
  "erp_service_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    serviceOrderId: uuid("service_order_id").notNull().references(() => erpServiceOrders.id, {
      onDelete: "cascade",
    }),
    position: integer("position").notNull().default(0),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOrderIdx: index("erp_service_order_items_company_order_idx").on(
      table.companyId,
      table.serviceOrderId,
    ),
    orderPositionUq: uniqueIndex("erp_service_order_items_order_position_uq").on(
      table.serviceOrderId,
      table.position,
    ),
  }),
);
