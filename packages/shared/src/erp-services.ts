/**
 * Serviços (service orders) module — Paperclip ERP.
 */

import { z } from "zod";

export const SERVICE_ORDER_STATUSES = ["open", "scheduled", "in_progress", "completed", "cancelled"] as const;
export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];

export const serviceOrderItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
});
export type ServiceOrderItem = z.infer<typeof serviceOrderItemSchema>;

export const createServiceOrderSchema = z.object({
  code: z.string().min(1).max(60).optional(),
  customerId: z.string().guid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  slaDueAt: z.string().datetime().optional().nullable(),
  items: z.array(serviceOrderItemSchema).min(1),
});
export type CreateServiceOrder = z.infer<typeof createServiceOrderSchema>;

export const scheduleServiceOrderSchema = z.object({
  scheduledAt: z.string().datetime(),
});

export const completeServiceOrderSchema = z.object({
  slaMet: z.boolean().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type CompleteServiceOrder = z.infer<typeof completeServiceOrderSchema>;

export function serviceOrderTotals(items: ServiceOrderItem[]): number {
  return items.reduce((sum, item) => sum + item.totalCents, 0);
}
