import { describe, expect, it } from "vitest";
import {
  addTrackingEventSchema,
  createFreightOrderSchema,
  linkFiscalDocumentSchema,
  scheduleFreightSchema,
} from "./erp-tms.js";

const validOrder = {
  carrierName: "Transportadora X",
  carrierTaxId: "14000123000123",
  destinationCity: "São Paulo",
  destinationState: "SP",
};

describe("tms validators", () => {
  it("accepts a valid freight order", () => {
    const parsed = createFreightOrderSchema.parse(validOrder);
    expect(parsed.carrierName).toBe("Transportadora X");
    expect(parsed.destinationState).toBe("SP");
  });

  it("requires a carrier", () => {
    expect(() => createFreightOrderSchema.parse({ destinationCity: "X" })).toThrow();
  });

  it("accepts scheduling and tracking events", () => {
    expect(scheduleFreightSchema.parse({ pickupAt: "2026-09-02T08:00:00.000Z" }).pickupAt).toBeTruthy();
    const tracking = addTrackingEventSchema.parse({ status: "in_transit", location: "Rodovia BR-101" });
    expect(tracking.status).toBe("in_transit");
    expect(() => addTrackingEventSchema.parse({ status: "lost" })).toThrow();
  });

  it("accepts fiscal links", () => {
    expect(
      linkFiscalDocumentSchema.parse({ fiscalDocumentId: "00000000-0000-0000-0000-000000000001" }).fiscalDocumentId,
    ).toBeTruthy();
  });
});
