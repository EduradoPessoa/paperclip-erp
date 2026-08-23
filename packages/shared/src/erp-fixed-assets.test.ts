import { describe, expect, it } from "vitest";
import {
  computeDepreciation,
  createFixedAssetSchema,
  disposeFixedAssetSchema,
  runDepreciationSchema,
} from "./erp-fixed-assets.js";

const validAsset = {
  name: "Empilhadeira",
  acquisitionDate: "2026-01-15T00:00:00.000Z",
  acquisitionCostCents: 12000000,
  usefulLifeMonths: 60,
  salvageValueCents: 0,
};

describe("fixed assets", () => {
  it("accepts a valid asset", () => {
    const parsed = createFixedAssetSchema.parse(validAsset);
    expect(parsed.acquisitionCostCents).toBe(12000000);
    expect(parsed.salvageValueCents).toBe(0);
  });

  it("rejects invalid life/cost", () => {
    expect(() => createFixedAssetSchema.parse({ ...validAsset, usefulLifeMonths: 0 })).toThrow();
    expect(() => createFixedAssetSchema.parse({ ...validAsset, acquisitionCostCents: 0 })).toThrow();
  });

  it("accepts depreciation and disposal payloads", () => {
    expect(runDepreciationSchema.parse({ periodEnd: "2026-01-31T00:00:00.000Z" }).periodEnd).toBeTruthy();
    expect(disposeFixedAssetSchema.parse({ disposalValueCents: 200000 }).disposalValueCents).toBe(200000);
  });

  it("computes linear depreciation correctly", () => {
    const step = computeDepreciation({
      acquisitionCostCents: 12000000,
      salvageValueCents: 0,
      usefulLifeMonths: 60,
      accumulatedDepreciationCents: 0,
    });
    expect(step.monthlyCents).toBe(200000);
    expect(step.nextDepreciationCents).toBe(200000);
    expect(step.bookValueAfterCents).toBe(11800000);
    expect(step.fullyDepreciated).toBe(false);

    const last = computeDepreciation({
      acquisitionCostCents: 12000000,
      salvageValueCents: 500000,
      usefulLifeMonths: 60,
      accumulatedDepreciationCents: 11300000,
    });
    expect(last.monthlyCents).toBe(191667);
    expect(last.nextDepreciationCents).toBe(191667);
    expect(last.bookValueAfterCents).toBe(508333);
    expect(last.fullyDepreciated).toBe(false);

    const final = computeDepreciation({
      acquisitionCostCents: 12000000,
      salvageValueCents: 500000,
      usefulLifeMonths: 60,
      accumulatedDepreciationCents: 11500000,
    });
    expect(final.nextDepreciationCents).toBe(0);
    expect(final.bookValueAfterCents).toBe(500000);
    expect(final.fullyDepreciated).toBe(true);
  });
});
