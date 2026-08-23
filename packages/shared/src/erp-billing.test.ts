import { describe, expect, it } from "vitest";
import {
  buildPlaceholderAccessKey,
  createBillingInvoiceSchema,
} from "./erp-billing.js";

const validInvoice = {
  salesOrderCaseId: "00000000-0000-0000-0000-000000000001",
  model: "nfe",
  series: 1,
  number: 1,
  emitter: {
    name: "Emitente Ltda",
    taxId: "14000123000123",
    state: "SP",
  },
};

describe("billing", () => {
  it("accepts a valid invoice request", () => {
    const parsed = createBillingInvoiceSchema.parse(validInvoice);
    expect(parsed.model).toBe("nfe");
    expect(parsed.series).toBe(1);
  });

  it("defaults model and series", () => {
    const parsed = createBillingInvoiceSchema.parse({
      salesOrderCaseId: validInvoice.salesOrderCaseId,
      emitter: validInvoice.emitter,
    });
    expect(parsed.model).toBe("nfe");
    expect(parsed.series).toBe(1);
  });

  it("rejects invalid emitters", () => {
    expect(() =>
      createBillingInvoiceSchema.parse({
        ...validInvoice,
        emitter: { name: "X", taxId: "abc" },
      }),
    ).toThrow();
  });

  it("builds 44-digit placeholder access keys, deterministic per input", () => {
    const input = { emitterTaxId: "14000123000123", model: "nfe", number: 1, series: 1 };
    const key = buildPlaceholderAccessKey(input);
    expect(key).toMatch(/^\d{44}$/);
    expect(buildPlaceholderAccessKey(input)).toBe(key);
  });
});
