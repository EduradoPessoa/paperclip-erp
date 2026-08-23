import { describe, expect, it } from "vitest";
import {
  completeServiceOrderSchema,
  createServiceOrderSchema,
  scheduleServiceOrderSchema,
  serviceOrderTotals,
} from "./erp-services.js";

const validOrder = {
  customerId: "00000000-0000-0000-0000-000000000001",
  title: "Manutenção preventiva",
  items: [{ description: "Visita técnica", quantity: 1, unitPriceCents: 30000, totalCents: 30000 }],
};

describe("service order validators", () => {
  it("accepts a valid service order", () => {
    const parsed = createServiceOrderSchema.parse(validOrder);
    expect(parsed.title).toBe("Manutenção preventiva");
    expect(parsed.items).toHaveLength(1);
  });

  it("requires items and a customer", () => {
    expect(() => createServiceOrderSchema.parse({ ...validOrder, items: [] })).toThrow();
    expect(() => createServiceOrderSchema.parse({ title: "X", items: validOrder.items })).toThrow();
  });

  it("accepts scheduling and completion", () => {
    expect(
      scheduleServiceOrderSchema.parse({ scheduledAt: "2026-09-01T10:00:00.000Z" }).scheduledAt,
    ).toBeTruthy();
    expect(completeServiceOrderSchema.parse({ slaMet: true }).slaMet).toBe(true);
  });

  it("totals items", () => {
    expect(serviceOrderTotals(validOrder.items)).toBe(30000);
  });
});
