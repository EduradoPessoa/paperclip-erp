/**
 * Exportação module — Paperclip ERP.
 */

import { z } from "zod";

export const EXPORT_ORDER_STATUSES = ["draft", "declared", "shipped", "cancelled"] as const;
export type ExportOrderStatus = (typeof EXPORT_ORDER_STATUSES)[number];

export const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"] as const;
export type Incoterm = (typeof INCOTERMS)[number];

export const exportOrderItemSchema = z.object({
  productId: z.string().guid(),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
});
export type ExportOrderItem = z.infer<typeof exportOrderItemSchema>;

export const createExportOrderSchema = z.object({
  code: z.string().min(1).max(60).optional(),
  customerId: z.string().guid(),
  incoterm: z.enum(INCOTERMS).optional().nullable(),
  currency: z.string().length(3).optional().default("USD"),
  exchangeRateBps: z.number().int().nonnegative().optional().nullable(),
  items: z.array(exportOrderItemSchema).min(1),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreateExportOrder = z.infer<typeof createExportOrderSchema>;

export const declareExportOrderSchema = z.object({
  documentNumber: z.string().min(1).max(60),
  documentDate: z.string().datetime().optional().nullable(),
});

export function exportOrderTotals(items: ExportOrderItem[]): number {
  return items.reduce((sum, item) => sum + item.totalCents, 0);
}
