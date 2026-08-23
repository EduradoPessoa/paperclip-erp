import { describe, expect, it } from "vitest";
import {
  createExportOrderSchema,
  declareExportOrderSchema,
  exportOrderTotals,
} from "./erp-exports.js";

const validOrder = {
  customerId: "00000000-0000-0000-0000-000000000001",
  incoterm: "FOB",
  currency: "USD",
  items: [{ productId: "00000000-0000-0000-0000-000000000002", quantity: 5, unitPriceCents: 20000, totalCents: 100000 }],
};

describe("export order validators", () => {
  it("accepts a valid export order", () => {
    const parsed = createExportOrderSchema.parse(validOrder);
    expect(parsed.incoterm).toBe("FOB");
    expect(parsed.currency).toBe("USD");
  });

  it("rejects invalid incoterms and currencies", () => {
    expect(() => createExportOrderSchema.parse({ ...validOrder, incoterm: "XYZ" })).toThrow();
    expect(() => createExportOrderSchema.parse({ ...validOrder, currency: "US" })).toThrow();
  });

  it("requires items and customer", () => {
    expect(() => createExportOrderSchema.parse({ ...validOrder, items: [] })).toThrow();
    expect(() => createExportOrderSchema.parse({ items: validOrder.items })).toThrow();
  });

  it("accepts declarations and totals", () => {
    expect(declareExportOrderSchema.parse({ documentNumber: "EXP-2026-001" }).documentNumber).toBeTruthy();
    expect(exportOrderTotals(validOrder.items)).toBe(100000);
  });
});
