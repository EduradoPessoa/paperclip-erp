import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { erpChartOfAccounts } from "./master_data.js";

/**
 * Contabilidade — Paperclip ERP.
 *
 * Double-entry journal: entries carry dated, balanced lines over the chart of
 * accounts. Debits must equal credits (validated in the service and by the
 * line check constraint).
 */

export const erpJournalEntries = pgTable(
  "erp_journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    entryNumber: integer("entry_number").notNull(),
    entryDate: timestamp("entry_date", { withTimezone: true }).notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("draft"),
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reverseReason: text("reverse_reason"),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyNumberUq: uniqueIndex("erp_journal_entries_company_number_uq").on(table.companyId, table.entryNumber),
    companyStatusIdx: index("erp_journal_entries_company_status_idx").on(table.companyId, table.status),
    companyDateIdx: index("erp_journal_entries_company_date_idx").on(table.companyId, table.entryDate),
  }),
);

export const erpJournalEntryLines = pgTable(
  "erp_journal_entry_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    journalEntryId: uuid("journal_entry_id").notNull().references(() => erpJournalEntries.id, {
      onDelete: "cascade",
    }),
    accountId: uuid("account_id").notNull().references(() => erpChartOfAccounts.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    debitCents: integer("debit_cents").notNull().default(0),
    creditCents: integer("credit_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyEntryIdx: index("erp_journal_entry_lines_company_entry_idx").on(
      table.companyId,
      table.journalEntryId,
    ),
    entryPositionUq: uniqueIndex("erp_journal_entry_lines_entry_position_uq").on(
      table.journalEntryId,
      table.position,
    ),
    singleSideCheck: check(
      "erp_journal_entry_lines_single_side_check",
      sql`(${table.debitCents} > 0 and ${table.creditCents} = 0) or (${table.creditCents} > 0 and ${table.debitCents} = 0)`,
    ),
  }),
);
