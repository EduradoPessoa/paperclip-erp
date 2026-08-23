import { describe, expect, it } from "vitest";
import {
  salesOrderFieldsSchema,
  salesOrderTotals,
} from "./erp-sales.js";

const validFields = {
  customerId: "00000000-0000-0000-0000-000000000001",
  items: [
    {
      productId: "00000000-0000-0000-0000-000000000002",
      description: "Licença anual",
      quantity: 1,
      unit: "UN",
      unitPriceCents: 120000,
      totalCents: 120000,
    },
  ],
};

describe("sales order fields", () => {
  it("accepts a valid sales order", () => {
    const parsed = salesOrderFieldsSchema.parse(validFields);
    expect(parsed.customerId).toBe(validFields.customerId);
    expect(parsed.items[0]?.totalCents).toBe(120000);
  });

  it("requires at least one item and a customer", () => {
    expect(() => salesOrderFieldsSchema.parse({ customerId: validFields.customerId, items: [] })).toThrow();
    expect(() => salesOrderFieldsSchema.parse({ items: validFields.items })).toThrow();
  });

  it("rejects negative prices", () => {
    expect(() =>
      salesOrderFieldsSchema.parse({
        ...validFields,
        items: [{ ...validFields.items[0]!, unitPriceCents: -5 }],
      }),
    ).toThrow();
  });

  it("totals sales order items", () => {
    expect(salesOrderTotals(salesOrderFieldsSchema.parse(validFields))).toBe(120000);
  });
});
