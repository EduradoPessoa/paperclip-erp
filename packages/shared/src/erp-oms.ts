/**
 * OMS (Order Management) module — Paperclip ERP.
 */

import { z } from "zod";

export const OMS_CHANNELS = ["marketplace", "website", "retail", "phone", "b2b", "other"] as const;
export type OmsChannel = (typeof OMS_CHANNELS)[number];

export const OMS_ORDER_STATUSES = ["received", "confirmed", "shipped", "delivered", "cancelled"] as const;
export type OmsOrderStatus = (typeof OMS_ORDER_STATUSES)[number];

export const omsOrderItemSchema = z.object({
  productId: z.string().guid().optional().nullable(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
});
export type OmsOrderItem = z.infer<typeof omsOrderItemSchema>;

export const createOmsOrderSchema = z.object({
  code: z.string().min(1).max(60).optional(),
  channel: z.enum(OMS_CHANNELS),
  externalOrderId: z.string().max(200).optional().nullable(),
  customerId: z.string().guid().optional().nullable(),
  promiseAt: z.string().datetime().optional().nullable(),
  items: z.array(omsOrderItemSchema).min(1),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreateOmsOrder = z.infer<typeof createOmsOrderSchema>;

export function omsOrderTotals(items: OmsOrderItem[]): number {
  return items.reduce((sum, item) => sum + item.totalCents, 0);
}
