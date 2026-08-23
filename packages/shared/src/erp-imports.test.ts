import { describe, expect, it } from "vitest";
import {
  allocateImportCosts,
  createImportOrderSchema,
  declareImportOrderSchema,
} from "./erp-imports.js";

const validOrder = {
  supplierId: "00000000-0000-0000-0000-000000000001",
  items: [{ productId: "00000000-0000-0000-0000-000000000002", quantity: 10, invoiceValueCents: 10000 }],
};

describe("import orders", () => {
  it("accepts a valid import order", () => {
    const parsed = createImportOrderSchema.parse(validOrder);
    expect(parsed.freightCostCents).toBe(0);
    expect(parsed.items).toHaveLength(1);
  });

  it("requires items and supplier", () => {
    expect(() => createImportOrderSchema.parse({ supplierId: "x", items: validOrder.items })).toThrow();
    expect(() => createImportOrderSchema.parse({ ...validOrder, items: [] })).toThrow();
  });

  it("accepts declarations", () => {
    expect(declareImportOrderSchema.parse({ documentNumber: "25/0000000-0" }).documentNumber).toBeTruthy();
    expect(() => declareImportOrderSchema.parse({ documentNumber: "" })).toThrow();
  });

  it("allocates landed costs proportionally", () => {
    const result = allocateImportCosts(
      [
        { invoiceValueCents: 6000, quantity: 6 },
        { invoiceValueCents: 4000, quantity: 4 },
      ],
      { freightCostCents: 500, insuranceCostCents: 500 },
    );
    expect(result.totalCostCents).toBe(11000);
    expect(result.items[0]!.allocatedCostCents).toBe(6600);
    expect(result.items[1]!.allocatedCostCents).toBe(4400);
  });
});
