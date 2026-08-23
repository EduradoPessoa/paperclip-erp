/**
 * Compras (purchasing) module — Paperclip ERP.
 *
 * The purchase-order document is a pipeline case with typed fields. The
 * pipeline defines the process (draft → human approval → sent → received →
 * closed/cancelled); the fields carry the business data validated here.
 */

import { z } from "zod";

export const PURCHASE_ORDER_PIPELINE_KEY = "purchase-order" as const;

export const PURCHASE_ORDER_STAGES = [
  { key: "draft", name: "Rascunho", kind: "working" },
  {
    key: "approval",
    name: "Aprovação",
    kind: "review",
    config: {
      approveToStageKey: "sent",
      rejectToStageKey: "cancelled",
      requestChangesToStageKey: "draft",
      requireRejectReason: true,
      reviewerKind: "human",
    },
  },
  { key: "sent", name: "Enviado ao fornecedor", kind: "working" },
  { key: "received", name: "Recebido", kind: "done" },
  { key: "closed", name: "Fechado", kind: "done" },
  { key: "cancelled", name: "Cancelado", kind: "cancelled" },
] as const;

export const purchaseOrderItemSchema = z.object({
  productId: z.string().guid().optional().nullable(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(10).optional().default("UN"),
  unitPriceCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
});
export type PurchaseOrderItem = z.infer<typeof purchaseOrderItemSchema>;

export const purchaseOrderFieldsSchema = z.object({
  supplierId: z.string().guid(),
  supplierName: z.string().max(200).optional().nullable(),
  expectedDate: z.string().datetime().optional().nullable(),
  paymentTerms: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(purchaseOrderItemSchema).min(1),
});
export type PurchaseOrderFields = z.infer<typeof purchaseOrderFieldsSchema>;

export function purchaseOrderTotals(fields: PurchaseOrderFields): number {
  return fields.items.reduce((sum, item) => sum + item.totalCents, 0);
}
