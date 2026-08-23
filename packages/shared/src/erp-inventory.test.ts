import { describe, expect, it } from "vitest";
import {
  createInventoryMovementSchema,
  inventoryDelta,
  receiveFromFiscalSchema,
} from "./erp-inventory.js";

describe("inventory", () => {
  it("computes signed deltas per movement type", () => {
    expect(inventoryDelta("inbound_receipt", 10)).toBe(10);
    expect(inventoryDelta("transfer_in", 5)).toBe(5);
    expect(inventoryDelta("outbound_shipment", 10)).toBe(-10);
    expect(inventoryDelta("transfer_out", 5)).toBe(-5);
    expect(inventoryDelta("adjustment", -3)).toBe(-3);
    expect(inventoryDelta("adjustment", 7)).toBe(7);
  });

  it("accepts valid movements", () => {
    const parsed = createInventoryMovementSchema.parse({
      productId: "00000000-0000-0000-0000-000000000001",
      movementType: "inbound_receipt",
      quantity: 100,
      unitCostCents: 500,
    });
    expect(parsed.quantity).toBe(100);
  });

  it("rejects zero quantity and negative outbound", () => {
    expect(() =>
      createInventoryMovementSchema.parse({
        productId: "00000000-0000-0000-0000-000000000001",
        movementType: "inbound_receipt",
        quantity: 0,
      }),
    ).toThrow();
    expect(() =>
      createInventoryMovementSchema.parse({
        productId: "00000000-0000-0000-0000-000000000001",
        movementType: "outbound_shipment",
        quantity: -5,
      }),
    ).toThrow();
  });

  it("accepts signed adjustments", () => {
    const parsed = createInventoryMovementSchema.parse({
      productId: "00000000-0000-0000-0000-000000000001",
      movementType: "adjustment",
      quantity: -3,
    });
    expect(parsed.movementType).toBe("adjustment");
  });

  it("validates receive-from-fiscal payloads", () => {
    const parsed = receiveFromFiscalSchema.parse({
      fiscalDocumentId: "00000000-0000-0000-0000-000000000002",
      items: [{ productId: "00000000-0000-0000-0000-000000000001", quantity: 10 }],
    });
    expect(parsed.items).toHaveLength(1);
    expect(() => receiveFromFiscalSchema.parse({ fiscalDocumentId: "x", items: [] })).toThrow();
  });
});
