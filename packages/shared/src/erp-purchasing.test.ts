import { describe, expect, it } from "vitest";
import {
  purchaseOrderFieldsSchema,
  purchaseOrderTotals,
} from "./erp-purchasing.js";

const validFields = {
  supplierId: "00000000-0000-0000-0000-000000000001",
  items: [
    {
      productId: "00000000-0000-0000-0000-000000000002",
      description: "Parafuso M8",
      quantity: 100,
      unit: "UN",
      unitPriceCents: 50,
      totalCents: 5000,
    },
  ],
};

describe("purchase order fields", () => {
  it("accepts a valid purchase order", () => {
    const parsed = purchaseOrderFieldsSchema.parse(validFields);
    expect(parsed.supplierId).toBe(validFields.supplierId);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.unit).toBe("UN");
  });

  it("requires at least one item", () => {
    expect(() => purchaseOrderFieldsSchema.parse({ supplierId: validFields.supplierId, items: [] })).toThrow();
  });

  it("rejects negative prices and zero quantities", () => {
    expect(() =>
      purchaseOrderFieldsSchema.parse({
        ...validFields,
        items: [{ ...validFields.items[0]!, unitPriceCents: -1 }],
      }),
    ).toThrow();
    expect(() =>
      purchaseOrderFieldsSchema.parse({
        ...validFields,
        items: [{ ...validFields.items[0]!, quantity: 0 }],
      }),
    ).toThrow();
  });

  it("totals order items", () => {
    expect(purchaseOrderTotals(purchaseOrderFieldsSchema.parse(validFields))).toBe(5000);
  });
});
