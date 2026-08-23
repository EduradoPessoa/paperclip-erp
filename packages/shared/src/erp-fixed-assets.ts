/**
 * Ativo Imobilizado module — Paperclip ERP.
 */

import { z } from "zod";

export const FIXED_ASSET_STATUSES = ["active", "depreciated", "disposed", "cancelled"] as const;
export type FixedAssetStatus = (typeof FIXED_ASSET_STATUSES)[number];

export const createFixedAssetSchema = z.object({
  code: z.string().min(1).max(60).optional(),
  name: z.string().min(1).max(200),
  category: z.string().max(120).optional().nullable(),
  acquisitionDate: z.string().datetime(),
  acquisitionCostCents: z.number().int().positive(),
  usefulLifeMonths: z.number().int().positive(),
  salvageValueCents: z.number().int().nonnegative().optional().default(0),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreateFixedAsset = z.infer<typeof createFixedAssetSchema>;

export const runDepreciationSchema = z.object({
  periodEnd: z.string().datetime(),
});

export const disposeFixedAssetSchema = z.object({
  disposalValueCents: z.number().int().nonnegative(),
  notes: z.string().max(1000).optional().nullable(),
});

export interface DepreciationInput {
  acquisitionCostCents: number;
  salvageValueCents: number;
  usefulLifeMonths: number;
  accumulatedDepreciationCents: number;
}

export interface DepreciationComputation {
  monthlyCents: number;
  remainingMonths: number;
  nextDepreciationCents: number;
  bookValueAfterCents: number;
  fullyDepreciated: boolean;
}

/**
 * Linear depreciation: (cost - salvage) / useful life, rounded to cents.
 * The final run is clamped to the remaining depreciable amount so book value
 * lands exactly on the salvage value.
 */
export function computeDepreciation(input: DepreciationInput): DepreciationComputation {
  const depreciable = input.acquisitionCostCents - input.salvageValueCents;
  const monthlyCents = input.usefulLifeMonths > 0 ? Math.round(depreciable / input.usefulLifeMonths) : 0;
  const bookValue = input.acquisitionCostCents - input.accumulatedDepreciationCents;
  const remainingDepreciable = Math.max(bookValue - input.salvageValueCents, 0);
  const next = Math.min(monthlyCents, remainingDepreciable);
  return {
    monthlyCents,
    remainingMonths: Math.max(Math.ceil(remainingDepreciable / Math.max(monthlyCents, 1)), 0),
    nextDepreciationCents: next,
    bookValueAfterCents: bookValue - next,
    fullyDepreciated: remainingDepreciable <= monthlyCents,
  };
}
