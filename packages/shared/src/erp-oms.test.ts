import { describe, expect, it } from "vitest";
import {
  createOmsOrderSchema,
  omsOrderTotals,
} from "./erp-oms.js";

const validOrder = {
  channel: "marketplace",
  externalOrderId: "MLB-123456",
  customerId: "00000000-0000-0000-0000-000000000001",
  promiseAt: "2026-09-10T00:00:00.000Z",
  items: [
    { productId: "00000000-0000-0000-0000-000000000002", description: "Camiseta M", quantity: 2, unitPriceCents: 5000, totalCents: 10000 },
  ],
};

describe("oms validators", () => {
  it("accepts a valid multi-channel order", () => {
    const parsed = createOmsOrderSchema.parse(validOrder);
    expect(parsed.channel).toBe("marketplace");
    expect(parsed.externalOrderId).toBe("MLB-123456");
    expect(parsed.promiseAt).toBeTruthy();
  });

  it("rejects unknown channels", () => {
    expect(() => createOmsOrderSchema.parse({ ...validOrder, channel: "telegram" })).toThrow();
  });

  it("requires items", () => {
    expect(() => createOmsOrderSchema.parse({ ...validOrder, items: [] })).toThrow();
  });

  it("accepts items without product (free-form) and totals", () => {
    const parsed = createOmsOrderSchema.parse({
      channel: "retail",
      items: [{ description: "Serviço avulso", quantity: 1, unitPriceCents: 1000, totalCents: 1000 }],
    });
    expect(parsed.items[0]?.productId).toBeUndefined();
    expect(omsOrderTotals(validOrder.items)).toBe(10000);
  });
});
