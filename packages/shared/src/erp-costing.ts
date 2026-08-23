/**
 * Custo module — Paperclip ERP.
 */

import { z } from "zod";

export const COST_CENTER_STATUSES = ["active", "inactive"] as const;
export type CostCenterStatus = (typeof COST_CENTER_STATUSES)[number];

export const createCostCenterSchema = z.object({
  code: z.string().min(1).max(60).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(COST_CENTER_STATUSES).optional().default("active"),
});
export type CreateCostCenter = z.infer<typeof createCostCenterSchema>;

export const createCostAllocationSchema = z.object({
  costCenterId: z.string().guid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  description: z.string().min(1).max(500),
  amountCents: z.number().int().nonnegative(),
  sourceType: z.string().max(60).optional().nullable(),
  sourceId: z.string().max(200).optional().nullable(),
});
export type CreateCostAllocation = z.infer<typeof createCostAllocationSchema>;

export interface ProductionCostMaterialInput {
  quantity: number;
  unitCostCents: number;
}
export interface ProductionCostBreakdown {
  materialsCents: number;
  laborCents: number;
  overheadCents: number;
  totalCents: number;
}

/** Production cost = materials (Σ qty × unit cost) + labor + overhead. */
export function computeProductionCost(
  materials: ProductionCostMaterialInput[],
  laborCents: number,
  overheadCents: number,
): ProductionCostBreakdown {
  const materialsCents = materials.reduce((sum, item) => sum + Math.round(item.quantity * item.unitCostCents), 0);
  return {
    materialsCents,
    laborCents,
    overheadCents,
    totalCents: materialsCents + laborCents + overheadCents,
  };
}
