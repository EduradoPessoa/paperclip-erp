/**
 * Contabilidade module — Paperclip ERP.
 */

import { z } from "zod";

export const JOURNAL_ENTRY_STATUSES = ["draft", "posted", "reversed", "cancelled"] as const;
export type JournalEntryStatus = (typeof JOURNAL_ENTRY_STATUSES)[number];

export const journalEntryLineSchema = z
  .object({
    accountId: z.string().guid(),
    debitCents: z.number().int().nonnegative().default(0),
    creditCents: z.number().int().nonnegative().default(0),
  })
  .refine((line) => (line.debitCents > 0) !== (line.creditCents > 0), {
    message: "each line must have exactly one side (debit or credit) with a positive amount",
  });
export type JournalEntryLine = z.infer<typeof journalEntryLineSchema>;

export const createJournalEntrySchema = z
  .object({
    entryDate: z.string().datetime(),
    description: z.string().min(1).max(500),
    sourceType: z.string().max(60).optional().nullable(),
    sourceId: z.string().max(200).optional().nullable(),
    lines: z.array(journalEntryLineSchema).min(2),
  })
  .refine((entry) => journalEntryIsBalanced(entry.lines), {
    message: "journal entry must be balanced (total debits = total credits > 0)",
  });
export type CreateJournalEntry = z.infer<typeof createJournalEntrySchema>;

export const reverseJournalEntrySchema = z.object({
  reason: z.string().min(5).max(1000),
});

/** True when debits total equals credits total and the total is positive. */
export function journalEntryIsBalanced(lines: Array<{ debitCents: number; creditCents: number }>): boolean {
  const debits = lines.reduce((sum, line) => sum + line.debitCents, 0);
  const credits = lines.reduce((sum, line) => sum + line.creditCents, 0);
  return debits === credits && debits > 0;
}
