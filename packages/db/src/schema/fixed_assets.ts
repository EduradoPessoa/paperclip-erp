import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * Ativo Imobilizado — Paperclip ERP.
 *
 * Fixed asset cards with linear depreciation. Depreciation runs are
 * append-only history per accounting period; the card keeps the accumulated
 * and book values.
 */

export const erpFixedAssets = pgTable(
  "erp_fixed_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    acquisitionDate: timestamp("acquisition_date", { withTimezone: true }).notNull(),
    acquisitionCostCents: integer("acquisition_cost_cents").notNull(),
    usefulLifeMonths: integer("useful_life_months").notNull(),
    salvageValueCents: integer("salvage_value_cents").notNull().default(0),
    depreciationMethod: text("depreciation_method").notNull().default("linear"),
    status: text("status").notNull().default("active"),
    accumulatedDepreciationCents: integer("accumulated_depreciation_cents").notNull().default(0),
    bookValueCents: integer("book_value_cents").notNull(),
    disposedAt: timestamp("disposed_at", { withTimezone: true }),
    disposalValueCents: integer("disposal_value_cents"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCodeUq: uniqueIndex("erp_fixed_assets_company_code_uq").on(table.companyId, table.code),
    companyStatusIdx: index("erp_fixed_assets_company_status_idx").on(table.companyId, table.status),
  }),
);

export const erpDepreciationRuns = pgTable(
  "erp_depreciation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").notNull().references(() => erpFixedAssets.id, { onDelete: "cascade" }),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    depreciationCents: integer("depreciation_cents").notNull(),
    bookValueAfterCents: integer("book_value_after_cents").notNull(),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAssetPeriodIdx: index("erp_depreciation_runs_company_asset_period_idx").on(
      table.companyId,
      table.assetId,
      table.periodEnd,
    ),
    assetIdx: index("erp_depreciation_runs_asset_idx").on(table.assetId),
  }),
);
