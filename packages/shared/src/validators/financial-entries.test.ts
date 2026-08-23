import { describe, expect, it } from "vitest";
import {
  createErpPayableSchema,
  createErpReceivableSchema,
  settleFinancialEntrySchema,
} from "./financial-entries.js";

describe("financial entries validators", () => {
  it("accepts a valid payable", () => {
    const parsed = createErpPayableSchema.parse({
      supplierId: "00000000-0000-0000-0000-000000000001",
      description: "Fatura de compra",
      amountCents: 100000,
      dueDate: "2026-09-15T00:00:00.000Z",
    });
    expect(parsed.currency).toBe("BRL");
    expect(parsed.amountCents).toBe(100000);
  });

  it("rejects zero/negative amounts", () => {
    expect(() =>
      createErpPayableSchema.parse({
        description: "X",
        amountCents: 0,
        dueDate: "2026-09-15T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("rejects invalid due dates", () => {
    expect(() =>
      createErpReceivableSchema.parse({ description: "X", amountCents: 10, dueDate: "not-a-date" }),
    ).toThrow();
  });

  it("accepts settlements with payment method", () => {
    const parsed = settleFinancialEntrySchema.parse({ paidAmountCents: 5000, paymentMethod: "pix" });
    expect(parsed.paidAmountCents).toBe(5000);
    expect(parsed.paymentMethod).toBe("pix");
  });
});
