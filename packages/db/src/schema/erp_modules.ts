import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * ERP module registry — Paperclip ERP.
 *
 * Each company activates the modules it uses (Compras, Vendas, Financeiro,
 * Fiscal, ...). The module key is the stable identity; future phases map
 * pipelines, case types, routines and skills to each module manifest.
 */

export const erpModules = pgTable(
  "erp_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    moduleKey: text("module_key").notNull(),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    installedByUserId: text("installed_by_user_id"),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyModuleUq: uniqueIndex("erp_modules_company_module_uq").on(table.companyId, table.moduleKey),
    companyIdx: index("erp_modules_company_idx").on(table.companyId),
  }),
);
