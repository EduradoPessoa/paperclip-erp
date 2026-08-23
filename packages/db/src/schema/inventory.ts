import { index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { erpProducts } from "./master_data.js";

/**
 * Estoques (inventory) — Paperclip ERP.
 *
 * Movements are the source of truth (append-only by contract); balance is the
 * signed sum of `deltaQuantity`. Lots track balance per batch when used.
 */

export const erpInventoryLots = pgTable(
  "erp_inventory_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => erpProducts.id, { onDelete: "cascade" }),
    lotCode: text("lot_code").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    expiryAt: timestamp("expiry_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProductLotUq: uniqueIndex("erp_inventory_lots_company_product_lot_uq").on(
      table.companyId,
      table.productId,
      table.lotCode,
    ),
    companyProductIdx: index("erp_inventory_lots_company_product_idx").on(table.companyId, table.productId),
  }),
);

export const erpInventoryMovements = pgTable(
  "erp_inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => erpProducts.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id").references(() => erpInventoryLots.id, { onDelete: "set null" }),
    movementType: text("movement_type").notNull(),
    /** Signed delta: inbound positive, outbound negative, adjustment signed. */
    deltaQuantity: numeric("delta_quantity", { precision: 14, scale: 4 }).notNull(),
    unitCostCents: integer("unit_cost_cents"),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    note: text("note"),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("erp_inventory_movements_company_created_idx").on(table.companyId, table.createdAt),
    companyProductIdx: index("erp_inventory_movements_company_product_idx").on(table.companyId, table.productId),
    lotIdx: index("erp_inventory_movements_lot_idx").on(table.lotId),
    referenceIdx: index("erp_inventory_movements_reference_idx").on(table.referenceType, table.referenceId),
  }),
);
