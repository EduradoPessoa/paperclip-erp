import { describe, expect, it } from "vitest";
import {
  completeProductionOrderSchema,
  createProductionOrderSchema,
} from "./erp-production.js";

const validOrder = {
  productId: "00000000-0000-0000-0000-000000000001",
  plannedQuantity: 100,
  items: [
    { productId: "00000000-0000-0000-0000-000000000002", plannedQuantity: 150, unitCostCents: 200 },
  ],
};

describe("production order validators", () => {
  it("accepts a valid production order", () => {
    const parsed = createProductionOrderSchema.parse(validOrder);
    expect(parsed.plannedQuantity).toBe(100);
    expect(parsed.items).toHaveLength(1);
  });

  it("requires materials and positive quantities", () => {
    expect(() => createProductionOrderSchema.parse({ ...validOrder, items: [] })).toThrow();
    expect(() =>
      createProductionOrderSchema.parse({ ...validOrder, plannedQuantity: -1 }),
    ).toThrow();
  });

  it("accepts completion with output", () => {
    const parsed = completeProductionOrderSchema.parse({ outputQuantity: 95 });
    expect(parsed.outputQuantity).toBe(95);
    expect(() => completeProductionOrderSchema.parse({ outputQuantity: 0 })).toThrow();
  });
});
