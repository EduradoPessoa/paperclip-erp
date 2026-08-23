import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { fiscalDocuments } from "./fiscal.js";

/**
 * TMS — Paperclip ERP.
 *
 * Freight orders carry carrier, origin/destination, pickup scheduling and a
 * freight cost. Tracking events are append-only; the linked fiscal document
 * (CT-e) connects transport to the fiscal module.
 */

export const erpFreightOrders = pgTable(
  "erp_freight_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    carrierName: text("carrier_name").notNull(),
    carrierTaxId: text("carrier_tax_id"),
    originCity: text("origin_city"),
    originState: text("origin_state"),
    destinationCity: text("destination_city"),
    destinationState: text("destination_state"),
    status: text("status").notNull().default("planned"),
    pickupAt: timestamp("pickup_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    freightCostCents: integer("freight_cost_cents"),
    fiscalDocumentId: uuid("fiscal_document_id").references(() => fiscalDocuments.id, { onDelete: "set null" }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCodeUq: uniqueIndex("erp_freight_orders_company_code_uq").on(table.companyId, table.code),
    companyStatusIdx: index("erp_freight_orders_company_status_idx").on(table.companyId, table.status),
    fiscalIdx: index("erp_freight_orders_fiscal_idx").on(table.fiscalDocumentId),
  }),
);

export const erpFreightTrackingEvents = pgTable(
  "erp_freight_tracking_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    freightOrderId: uuid("freight_order_id").notNull().references(() => erpFreightOrders.id, {
      onDelete: "cascade",
    }),
    status: text("status").notNull(),
    location: text("location"),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOrderCreatedIdx: index("erp_freight_tracking_events_company_order_created_idx").on(
      table.companyId,
      table.freightOrderId,
      table.createdAt,
    ),
    orderIdx: index("erp_freight_tracking_events_order_idx").on(table.freightOrderId),
  }),
);
