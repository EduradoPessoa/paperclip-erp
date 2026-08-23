import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * Custo — Paperclip ERP.
 *
 * Cost centers plus period allocations (materials, labor, overhead) with
 * source references. Production cost is computed from the production order
 * materials plus allocations bound to the order.
 */

export const erpCostCenters = pgTable(
  "erp_cost_centers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCodeUq: uniqueIndex("erp_cost_centers_company_code_uq").on(table.companyId, table.code),
    companyIdx: index("erp_cost_centers_company_idx").on(table.companyId),
  }),
);

export const erpCostAllocations = pgTable(
  "erp_cost_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    costCenterId: uuid("cost_center_id").notNull().references(() => erpCostCenters.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyPeriodIdx: index("erp_cost_allocations_company_period_idx").on(table.companyId, table.periodStart),
    centerIdx: index("erp_cost_allocations_center_idx").on(table.costCenterId),
    sourceIdx: index("erp_cost_allocations_source_idx").on(table.sourceType, table.sourceId),
  }),
);
