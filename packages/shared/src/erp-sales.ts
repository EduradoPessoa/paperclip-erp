/**
 * Vendas (sales) module — Paperclip ERP.
 *
 * The sales order is a pipeline case with typed fields; the pipeline defines
 * the process (draft → human approval → confirmed → invoiced → delivered /
 * cancelled). Invoicing against an outbound fiscal document creates the
 * receivable.
 */

import { z } from "zod";

export const SALES_ORDER_PIPELINE_KEY = "sales-order" as const;

export const SALES_ORDER_STAGES = [
  { key: "draft", name: "Rascunho", kind: "working" },
  {
    key: "approval",
    name: "Aprovação",
    kind: "review",
    config: {
      approveToStageKey: "confirmed",
      rejectToStageKey: "cancelled",
      requestChangesToStageKey: "draft",
      requireRejectReason: true,
      reviewerKind: "human",
    },
  },
  { key: "confirmed", name: "Confirmado", kind: "working" },
  { key: "invoiced", name: "Faturado", kind: "working" },
  { key: "delivered", name: "Entregue", kind: "done" },
  { key: "cancelled", name: "Cancelado", kind: "cancelled" },
] as const;

export const salesOrderItemSchema = z.object({
  productId: z.string().guid().optional().nullable(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(10).optional().default("UN"),
  unitPriceCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
});
export type SalesOrderItem = z.infer<typeof salesOrderItemSchema>;

export const salesOrderFieldsSchema = z.object({
  customerId: z.string().guid(),
  customerName: z.string().max(200).optional().nullable(),
  expectedDate: z.string().datetime().optional().nullable(),
  paymentTerms: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(salesOrderItemSchema).min(1),
});
export type SalesOrderFields = z.infer<typeof salesOrderFieldsSchema>;

export function salesOrderTotals(fields: SalesOrderFields): number {
  return fields.items.reduce((sum, item) => sum + item.totalCents, 0);
}
