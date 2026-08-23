/**
 * Contabilidade service — Paperclip ERP.
 *
 * Double-entry journal over the chart of accounts: balanced entries (debits =
 * credits), numbered sequentially per company, with draft → posted →
 * reversed/cancelled lifecycle.
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { erpChartOfAccounts, erpJournalEntries, erpJournalEntryLines } from "@paperclipai/db";
import type { CreateJournalEntry } from "@paperclipai/shared";
import { journalEntryIsBalanced } from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";

export interface AccountingActor {
  actorType: "user" | "agent" | "system";
  actorId: string;
}

export function accountingService(db: Db) {
  async function assertAccountsInCompany(companyId: string, lines: Array<{ accountId: string }>) {
    for (const line of lines) {
      const row = await db
        .select({ id: erpChartOfAccounts.id, companyId: erpChartOfAccounts.companyId })
        .from(erpChartOfAccounts)
        .where(eq(erpChartOfAccounts.id, line.accountId))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound(`Account "${line.accountId}" not found`);
      if (row.companyId !== companyId) throw unprocessable("Account does not belong to company");
    }
  }

  async function nextEntryNumber(companyId: string): Promise<number> {
    const [row] = await db
      .select({ max: sql<number>`coalesce(max(${erpJournalEntries.entryNumber}), 0)::int` })
      .from(erpJournalEntries)
      .where(eq(erpJournalEntries.companyId, companyId));
    return Number(row?.max ?? 0) + 1;
  }

  async function loadEntry(companyId: string, entryId: string) {
    const row = await db
      .select()
      .from(erpJournalEntries)
      .where(and(eq(erpJournalEntries.id, entryId), eq(erpJournalEntries.companyId, companyId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Journal entry not found");
    return row;
  }

  async function loadLines(companyId: string, entryId: string) {
    return db
      .select()
      .from(erpJournalEntryLines)
      .where(
        and(
          eq(erpJournalEntryLines.companyId, companyId),
          eq(erpJournalEntryLines.journalEntryId, entryId),
        ),
      )
      .orderBy(asc(erpJournalEntryLines.position));
  }

  return {
    createEntry: async (companyId: string, input: CreateJournalEntry, userId: string | null) => {
      await assertAccountsInCompany(companyId, input.lines);
      const entryNumber = await nextEntryNumber(companyId);
      const [entry] = await db
        .insert(erpJournalEntries)
        .values({
          companyId,
          entryNumber,
          entryDate: new Date(input.entryDate),
          description: input.description,
          sourceType: input.sourceType ?? null,
          sourceId: input.sourceId ?? null,
          createdByUserId: userId,
        })
        .returning();
      for (const [index, line] of input.lines.entries()) {
        await db.insert(erpJournalEntryLines).values({
          companyId,
          journalEntryId: entry!.id,
          accountId: line.accountId,
          position: index,
          debitCents: line.debitCents,
          creditCents: line.creditCents,
        });
      }
      return { entry, lines: await loadLines(companyId, entry!.id) };
    },

    listEntries: async (companyId: string, options: { limit: number; offset: number }) =>
      db
        .select()
        .from(erpJournalEntries)
        .where(eq(erpJournalEntries.companyId, companyId))
        .orderBy(desc(erpJournalEntries.entryDate), desc(erpJournalEntries.createdAt))
        .limit(options.limit)
        .offset(options.offset),

    getEntry: async (companyId: string, entryId: string) => {
      const entry = await loadEntry(companyId, entryId);
      return { entry, lines: await loadLines(companyId, entryId) };
    },

    postEntry: async (companyId: string, entryId: string) => {
      const entry = await loadEntry(companyId, entryId);
      if (entry.status !== "draft") {
        throw conflict(`Journal entry cannot be posted from status "${entry.status}"`);
      }
      const lines = await loadLines(companyId, entryId);
      if (!journalEntryIsBalanced(lines)) {
        throw unprocessable("Journal entry is not balanced (debits ≠ credits)");
      }
      const [updated] = await db
        .update(erpJournalEntries)
        .set({ status: "posted", postedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(erpJournalEntries.id, entryId), eq(erpJournalEntries.companyId, companyId)))
        .returning();
      return updated;
    },

    reverseEntry: async (companyId: string, entryId: string, reason: string) => {
      const entry = await loadEntry(companyId, entryId);
      if (entry.status !== "posted") {
        throw conflict(`Only posted entries can be reversed (status "${entry.status}")`);
      }
      const [updated] = await db
        .update(erpJournalEntries)
        .set({ status: "reversed", reversedAt: new Date(), reverseReason: reason, updatedAt: new Date() })
        .where(and(eq(erpJournalEntries.id, entryId), eq(erpJournalEntries.companyId, companyId)))
        .returning();
      return updated;
    },

    cancelEntry: async (companyId: string, entryId: string) => {
      const entry = await loadEntry(companyId, entryId);
      if (entry.status !== "draft") {
        throw conflict(`Only draft entries can be cancelled (status "${entry.status}")`);
      }
      const [updated] = await db
        .update(erpJournalEntries)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(erpJournalEntries.id, entryId), eq(erpJournalEntries.companyId, companyId)))
        .returning();
      return updated;
    },
  };
}
