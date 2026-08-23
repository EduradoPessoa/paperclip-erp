/**
 * WMS module — Paperclip ERP.
 *
 * Locations (endereçamento), stock per location (derived from inventory
 * movements), pick waves (ondas de separação) and cycle counts (inventário
 * cíclico). Picks/count approvals post inventory movements so movements stay
 * the single source of truth.
 */

import { z } from "zod";

export const WMS_LOCATION_STATUSES = ["active", "inactive"] as const;
export type WmsLocationStatus = (typeof WMS_LOCATION_STATUSES)[number];

export const PICK_WAVE_STATUSES = ["draft", "active", "completed", "cancelled"] as const;
export type PickWaveStatus = (typeof PICK_WAVE_STATUSES)[number];

export const CYCLE_COUNT_STATUSES = ["open", "approved", "cancelled"] as const;
export type CycleCountStatus = (typeof CYCLE_COUNT_STATUSES)[number];

export const createWmsLocationSchema = z.object({
  code: z.string().min(1).max(60).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "code must be a valid location code"),
  zone: z.string().max(60).optional().nullable(),
  aisle: z.string().max(60).optional().nullable(),
  description: z.string().max(300).optional().nullable(),
  status: z.enum(WMS_LOCATION_STATUSES).optional().default("active"),
});
export type CreateWmsLocation = z.infer<typeof createWmsLocationSchema>;

export const putAwaySchema = z.object({
  locationId: z.string().guid(),
  productId: z.string().guid(),
  quantity: z.number().positive(),
});
export type PutAway = z.infer<typeof putAwaySchema>;

export const pickSchema = z.object({
  locationId: z.string().guid(),
  productId: z.string().guid(),
  quantity: z.number().positive(),
});
export type Pick = z.infer<typeof pickSchema>;

export const createPickWaveSchema = z.object({
  code: z.string().min(1).max(60).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().guid(),
        quantity: z.number().positive(),
        locationId: z.string().guid().optional().nullable(),
      }),
    )
    .min(1),
});
export type CreatePickWave = z.infer<typeof createPickWaveSchema>;

export const createCycleCountSchema = z.object({
  locationId: z.string().guid().optional().nullable(),
  productId: z.string().guid(),
  countedQuantity: z.number().nonnegative(),
  notes: z.string().max(1000).optional().nullable(),
});
export type CreateCycleCount = z.infer<typeof createCycleCountSchema>;
