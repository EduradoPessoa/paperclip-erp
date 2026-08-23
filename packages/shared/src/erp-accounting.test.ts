import { describe, expect, it } from "vitest";
import {
  createJournalEntrySchema,
  journalEntryIsBalanced,
} from "./erp-accounting.js";

const accountA = "00000000-0000-0000-0000-000000000001";
const accountB = "00000000-0000-0000-0000-000000000002";

describe("journal entries", () => {
  it("accepts a balanced entry", () => {
    const parsed = createJournalEntrySchema.parse({
      entryDate: "2026-09-30T00:00:00.000Z",
      description: "Compra a prazo",
      lines: [
        { accountId: accountA, debitCents: 10000 },
        { accountId: accountB, creditCents: 10000 },
      ],
    });
    expect(parsed.lines).toHaveLength(2);
  });

  it("rejects unbalanced entries", () => {
    expect(() =>
      createJournalEntrySchema.parse({
        entryDate: "2026-09-30T00:00:00.000Z",
        description: "Quebrado",
        lines: [
          { accountId: accountA, debitCents: 10000 },
          { accountId: accountB, creditCents: 9000 },
        ],
      }),
    ).toThrow();
  });

  it("rejects lines with both sides set or neither", () => {
    expect(() =>
      createJournalEntrySchema.parse({
        entryDate: "2026-09-30T00:00:00.000Z",
        description: "X",
        lines: [
          { accountId: accountA, debitCents: 100, creditCents: 100 },
          { accountId: accountB, creditCents: 200 },
        ],
      }),
    ).toThrow();
  });

  it("balance helper is correct", () => {
    expect(journalEntryIsBalanced([{ debitCents: 500, creditCents: 0 }, { debitCents: 0, creditCents: 500 }])).toBe(true);
    expect(journalEntryIsBalanced([{ debitCents: 500, creditCents: 0 }])).toBe(false);
  });
});
