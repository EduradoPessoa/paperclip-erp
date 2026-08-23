/**
 * TMS module — Paperclip ERP.
 */

import { z } from "zod";

export const FREIGHT_ORDER_STATUSES = ["planned", "scheduled", "in_transit", "delivered", "cancelled"] as const;
export type FreightOrderStatus = (typeof FREIGHT_ORDER_STATUSES)[number];

export const TRACKING_STATUSES = ["picked_up", "in_transit", "out_for_delivery", "delivered", "failed"] as const;
export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

export const createFreightOrderSchema = z.object({
  code: z.string().min(1).max(60).optional(),
  carrierName: z.string().min(1).max(200),
  carrierTaxId: z.string().max(14).optional().nullable(),
  originCity: z.string().max(100).optional().nullable(),
  originState: z.string().length(2).optional().nullable(),
  destinationCity: z.string().max(100).optional().nullable(),
  destinationState: z.string().length(2).optional().nullable(),
  pickupAt: z.string().datetime().optional().nullable(),
  freightCostCents: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreateFreightOrder = z.infer<typeof createFreightOrderSchema>;

export const scheduleFreightSchema = z.object({
  pickupAt: z.string().datetime(),
});

export const addTrackingEventSchema = z.object({
  status: z.enum(TRACKING_STATUSES),
  location: z.string().max(200).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  occurredAt: z.string().datetime().optional(),
});
export type AddTrackingEvent = z.infer<typeof addTrackingEventSchema>;

export const linkFiscalDocumentSchema = z.object({
  fiscalDocumentId: z.string().guid(),
});
