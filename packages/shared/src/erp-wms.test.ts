import { describe, expect, it } from "vitest";
import {
  createCycleCountSchema,
  createPickWaveSchema,
  createWmsLocationSchema,
  pickSchema,
  putAwaySchema,
} from "./erp-wms.js";

describe("wms validators", () => {
  it("accepts a valid location", () => {
    const parsed = createWmsLocationSchema.parse({ code: "A-01-02", zone: "A", aisle: "01" });
    expect(parsed.code).toBe("A-01-02");
    expect(parsed.status).toBe("active");
  });

  it("rejects invalid location codes", () => {
    expect(() => createWmsLocationSchema.parse({ code: "rua da alegria" })).toThrow();
  });

  it("accepts put-away and pick payloads", () => {
    const base = {
      locationId: "00000000-0000-0000-0000-000000000001",
      productId: "00000000-0000-0000-0000-000000000002",
    };
    expect(putAwaySchema.parse({ ...base, quantity: 50 }).quantity).toBe(50);
    expect(pickSchema.parse({ ...base, quantity: 5 }).quantity).toBe(5);
    expect(() => pickSchema.parse({ ...base, quantity: 0 })).toThrow();
  });

  it("accepts pick waves with items", () => {
    const parsed = createPickWaveSchema.parse({
      items: [{ productId: "00000000-0000-0000-0000-000000000002", quantity: 3, locationId: "00000000-0000-0000-0000-000000000001" }],
    });
    expect(parsed.items).toHaveLength(1);
    expect(() => createPickWaveSchema.parse({ items: [] })).toThrow();
  });

  it("accepts cycle counts", () => {
    const parsed = createCycleCountSchema.parse({
      productId: "00000000-0000-0000-0000-000000000002",
      countedQuantity: 10,
    });
    expect(parsed.countedQuantity).toBe(10);
    expect(() => createCycleCountSchema.parse({ productId: "x", countedQuantity: -1 })).toThrow();
  });
});
