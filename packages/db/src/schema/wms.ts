import { index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { erpProducts } from "./master_data.js";

/**
 * WMS — Paperclip ERP.
 *
 * Locations are warehouse addresses; stock per location is derived from
 * inventory movements (referenceType = "wms_location"), keeping movements the
 * single source of truth. Pick waves group picks; cycle counts reconcile
 * physical stock and post adjustment movements.
 */

export const erpWmsLocations = pgTable(
  "erp_wms_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    zone: text("zone"),
    aisle: text("aisle"),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCodeUq: uniqueIndex("erp_wms_locations_company_code_uq").on(table.companyId, table.code),
    companyIdx: index("erp_wms_locations_company_idx").on(table.companyId),
  }),
);

export const erpWmsPickWaves = pgTable(
  "erp_wms_pick_waves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    status: text("status").notNull().default("draft"),
    items: jsonb("items")
      .$type<Array<{ productId: string; quantity: number; locationId?: string | null }>>()
      .notNull()
      .default([]),
    itemCount: integer("item_count").notNull().default(0),
    createdByUserId: text("created_by_user_id"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCodeUq: uniqueIndex("erp_wms_pick_waves_company_code_uq").on(table.companyId, table.code),
    companyStatusIdx: index("erp_wms_pick_waves_company_status_idx").on(table.companyId, table.status),
  }),
);

export const erpWmsCycleCounts = pgTable(
  "erp_wms_cycle_counts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => erpWmsLocations.id, { onDelete: "set null" }),
    productId: uuid("product_id").notNull().references(() => erpProducts.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("open"),
    countedQuantity: numeric("counted_quantity", { precision: 14, scale: 4 }).notNull(),
    systemQuantity: numeric("system_quantity", { precision: 14, scale: 4 }),
    difference: numeric("difference", { precision: 14, scale: 4 }),
    notes: text("notes"),
    countedAt: timestamp("counted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("erp_wms_cycle_counts_company_status_idx").on(table.companyId, table.status),
    locationIdx: index("erp_wms_cycle_counts_location_idx").on(table.locationId),
    productIdx: index("erp_wms_cycle_counts_product_idx").on(table.productId),
  }),
);
