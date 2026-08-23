/**
 * Estoques (inventory) module — Paperclip ERP.
 *
 * Movements are the source of truth (append-only); balance is the signed sum
 * of deltas. Lots track balance per batch. The sign helper is shared so
 * server and tests agree on direction semantics.
 */

import { z } from "zod";

export const INVENTORY_MOVEMENT_TYPES = [
  "inbound_receipt",
  "outbound_shipment",
  "adjustment",
  "transfer_in",
  "transfer_out",
] as const;
export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

/** Signed delta for a movement type. `adjustment` carries its own sign. */
export function inventoryDelta(type: InventoryMovementType, quantity: number): number {
  switch (type) {
    case "inbound_receipt":
    case "transfer_in":
      return Math.abs(quantity);
    case "outbound_shipment":
    case "transfer_out":
      return -Math.abs(quantity);
    case "adjustment":
      return quantity;
  }
}

export const createInventoryMovementSchema = z.object({
  productId: z.string().guid(),
  movementType: z.enum(INVENTORY_MOVEMENT_TYPES),
  quantity: z.number().finite(),
  lotCode: z.string().max(120).optional().nullable(),
  unitCostCents: z.number().int().nonnegative().optional().nullable(),
  referenceType: z.string().max(60).optional().nullable(),
  referenceId: z.string().max(200).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
})
  .refine((value) => value.quantity !== 0, { message: "quantity must be non-zero" })
  .refine(
    (value) =>
      value.movementType === "adjustment" || value.quantity > 0,
    { message: "inbound/outbound/transfer movements require a positive quantity" },
  );
export type CreateInventoryMovement = z.infer<typeof createInventoryMovementSchema>;

export const receiveFromFiscalSchema = z.object({
  fiscalDocumentId: z.string().guid(),
  items: z
    .array(
      z.object({
        productId: z.string().guid(),
        quantity: z.number().positive(),
        lotCode: z.string().max(120).optional().nullable(),
        unitCostCents: z.number().int().nonnegative().optional().nullable(),
      }),
    )
    .min(1),
});
export type ReceiveFromFiscal = z.infer<typeof receiveFromFiscalSchema>;

export const shipFromSalesSchema = z.object({
  salesOrderCaseId: z.string().guid(),
  items: z
    .array(
      z.object({
        productId: z.string().guid(),
        quantity: z.number().positive(),
        lotCode: z.string().max(120).optional().nullable(),
      }),
    )
    .min(1),
});
export type ShipFromSales = z.infer<typeof shipFromSalesSchema>;
