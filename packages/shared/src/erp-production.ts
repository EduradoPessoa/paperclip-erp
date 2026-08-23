/**
 * PCP (production planning and control) module — Paperclip ERP.
 */

import { z } from "zod";

export const PRODUCTION_ORDER_STATUSES = [
  "planned",
  "released",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type ProductionOrderStatus = (typeof PRODUCTION_ORDER_STATUSES)[number];

export const createProductionOrderSchema = z.object({
  code: z.string().min(1).max(60).optional(),
  productId: z.string().guid(),
  plannedQuantity: z.number().positive(),
  items: z
    .array(
      z.object({
        productId: z.string().guid(),
        plannedQuantity: z.number().positive(),
        unitCostCents: z.number().int().nonnegative().optional().nullable(),
      }),
    )
    .min(1),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreateProductionOrder = z.infer<typeof createProductionOrderSchema>;

export const completeProductionOrderSchema = z.object({
  outputQuantity: z.number().positive(),
  notes: z.string().max(2000).optional().nullable(),
});
export type CompleteProductionOrder = z.infer<typeof completeProductionOrderSchema>;
