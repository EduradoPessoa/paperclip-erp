import { describe, expect, it } from "vitest";
import {
  cancelFiscalDocumentSchema,
  createFiscalDocumentSchema,
  fiscalProviderBindingSchema,
} from "./fiscal.js";

const validDraft = {
  model: "nfe",
  operationDirection: "outbound",
  number: 1,
  series: 1,
  accessKey: "35260814000123000000000000000000000000000001",
  emitter: {
    name: "Emitente Ltda",
    taxId: "14000123000123",
    stateTaxId: "123456789",
    state: "SP",
  },
  receiver: {
    name: "Cliente SA",
    taxId: "11111111000191",
  },
  items: [
    {
      description: "Produto A",
      ncm: "84713000",
      quantity: 2,
      unit: "UN",
      unitPriceCents: 5000,
      totalCents: 10000,
      taxes: [{ taxType: "icms", baseCents: 10000, rateBps: 1800, amountCents: 1800, creditable: true }],
    },
  ],
  totalsCents: 10000,
  taxes: [
    { taxType: "cbs", baseCents: 10000, rateBps: 10, amountCents: 1, creditable: false },
    { taxType: "ibs", baseCents: 10000, rateBps: 10, amountCents: 1, creditable: false },
  ],
  splitPayment: { enabled: true, withheldCents: 2, rateBps: 20 },
};

describe("fiscal validators", () => {
  it("accepts a valid NF-e outbound draft with IBS/CBS taxes", () => {
    const parsed = createFiscalDocumentSchema.parse(validDraft);
    expect(parsed.model).toBe("nfe");
    expect(parsed.taxes).toHaveLength(2);
    expect(parsed.splitPayment?.enabled).toBe(true);
  });

  it("rejects a malformed access key", () => {
    expect(() =>
      createFiscalDocumentSchema.parse({ ...validDraft, accessKey: "123" }),
    ).toThrow();
  });

  it("rejects non-digit tax ids", () => {
    expect(() =>
      createFiscalDocumentSchema.parse({
        ...validDraft,
        emitter: { ...validDraft.emitter, taxId: "14.000.123/0001-23" },
      }),
    ).toThrow();
  });

  it("requires at least one item", () => {
    expect(() =>
      createFiscalDocumentSchema.parse({ ...validDraft, items: [] }),
    ).toThrow();
  });

  it("validates cancel justifications", () => {
    expect(cancelFiscalDocumentSchema.parse({ justification: "Emissão indevida" }).justification)
      .toBe("Emissão indevida");
    expect(() => cancelFiscalDocumentSchema.parse({ justification: "x" })).toThrow();
  });

  it("defaults binding environment to homologation", () => {
    const binding = fiscalProviderBindingSchema.parse({
      providerKey: "spedy",
      config: {},
    });
    expect(binding.config.environment).toBe("homologation");
  });

  it("rejects unknown provider keys", () => {
    expect(() =>
      fiscalProviderBindingSchema.parse({ providerKey: "unknown-gateway", config: {} }),
    ).toThrow();
  });
});
