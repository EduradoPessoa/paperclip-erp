import { describe, expect, it } from "vitest";
import {
  computeProductionCost,
  createCostAllocationSchema,
  createCostCenterSchema,
} from "./erp-costing.js";

describe("costing", () => {
  it("accepts a valid cost center", () => {
    const parsed = createCostCenterSchema.parse({ name: "Produção", description: "Linha 1" });
    expect(parsed.name).toBe("Produção");
    expect(parsed.status).toBe("active");
  });

  it("accepts a valid allocation", () => {
    const parsed = createCostAllocationSchema.parse({
      costCenterId: "00000000-0000-0000-0000-000000000001",
      periodStart: "2026-09-01T00:00:00.000Z",
      periodEnd: "2026-09-30T00:00:00.000Z",
      description: "Mão de obra",
      amountCents: 500000,
    });
    expect(parsed.amountCents).toBe(500000);
  });

  it("rejects allocations without a center", () => {
    expect(() =>
      createCostAllocationSchema.parse({
        periodStart: "2026-09-01T00:00:00.000Z",
        periodEnd: "2026-09-30T00:00:00.000Z",
        description: "X",
        amountCents: 10,
      }),
    ).toThrow();
  });

  it("computes production cost breakdown", () => {
    const breakdown = computeProductionCost(
      [
        { quantity: 10, unitCostCents: 100 },
        { quantity: 5, unitCostCents: 200 },
      ],
      50000,
      10000,
    );
    expect(breakdown.materialsCents).toBe(2000);
    expect(breakdown.totalCents).toBe(62000);
  });
});
