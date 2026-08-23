/**
 * Importação module — Paperclip ERP.
 */

import { z } from "zod";

export const IMPORT_ORDER_STATUSES = ["draft", "declared", "cleared", "cancelled"] as const;
export type ImportOrderStatus = (typeof IMPORT_ORDER_STATUSES)[number];

export const importOrderItemSchema = z.object({
  productId: z.string().guid(),
  quantity: z.number().positive(),
  invoiceValueCents: z.number().int().nonnegative().default(0),
});
export type ImportOrderItem = z.infer<typeof importOrderItemSchema>;

export const createImportOrderSchema = z.object({
  code: z.string().min(1).max(60).optional(),
  supplierId: z.string().guid(),
  documentNumber: z.string().max(60).optional().nullable(),
  documentDate: z.string().datetime().optional().nullable(),
  arrivalDate: z.string().datetime().optional().nullable(),
  freightCostCents: z.number().int().nonnegative().optional().default(0),
  insuranceCostCents: z.number().int().nonnegative().optional().default(0),
  exchangeRateBps: z.number().int().nonnegative().optional().nullable(),
  items: z.array(importOrderItemSchema).min(1),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreateImportOrder = z.infer<typeof createImportOrderSchema>;

export const declareImportOrderSchema = z.object({
  documentNumber: z.string().min(1).max(60),
  documentDate: z.string().datetime().optional().nullable(),
});

export interface ImportAllocationItemInput {
  invoiceValueCents: number;
  quantity: number;
}
export interface ImportAllocationItemResult extends ImportAllocationItemInput {
  allocatedCostCents: number;
}
export interface ImportAllocationResult {
  items: ImportAllocationItemResult[];
  totalCostCents: number;
}

/**
 * Landed-cost allocation: distributes freight + insurance proportionally to
 * item invoice values and adds them to each item's cost.
 */
export function allocateImportCosts(
  items: ImportAllocationItemInput[],
  extras: { freightCostCents: number; insuranceCostCents: number },
): ImportAllocationResult {
  const extrasTotal = extras.freightCostCents + extras.insuranceCostCents;
  const invoiceTotal = items.reduce((sum, item) => sum + item.invoiceValueCents, 0);
  const allocated = items.map((item) => {
    const share = invoiceTotal > 0 ? (item.invoiceValueCents / invoiceTotal) * extrasTotal : 0;
    return {
      ...item,
      allocatedCostCents: item.invoiceValueCents + Math.round(share),
    };
  });
  const totalCostCents = allocated.reduce((sum, item) => sum + item.allocatedCostCents, 0);
  return { items: allocated, totalCostCents };
}
