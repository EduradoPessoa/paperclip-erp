/**
 * PCP service — Paperclip ERP.
 *
 * Production orders consume raw materials and produce the finished good via
 * inventory movements (single source of truth). Completing an order checks
 * material availability first, then posts consumption + production.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { erpProductionOrderItems, erpProductionOrders, erpProducts } from "@paperclipai/db";
import type { CompleteProductionOrder, CreateProductionOrder } from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { inventoryService, type InventoryActor } from "./inventory.js";

export interface ProductionActor extends InventoryActor {}

export function productionService(db: Db) {
  const inventory = inventoryService(db);

  async function assertProductInCompany(companyId: string, productId: string) {
    const row = await db
      .select({ id: erpProducts.id, companyId: erpProducts.companyId })
      .from(erpProducts)
      .where(eq(erpProducts.id, productId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Product not found");
    if (row.companyId !== companyId) throw unprocessable("Product does not belong to company");
  }

  async function loadOrder(companyId: string, orderId: string) {
    const row = await db
      .select()
      .from(erpProductionOrders)
      .where(and(eq(erpProductionOrders.id, orderId), eq(erpProductionOrders.companyId, companyId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Production order not found");
    return row;
  }

  async function loadItems(companyId: string, orderId: string) {
    return db
      .select()
      .from(erpProductionOrderItems)
      .where(
        and(
          eq(erpProductionOrderItems.companyId, companyId),
          eq(erpProductionOrderItems.productionOrderId, orderId),
        ),
      )
      .orderBy(asc(erpProductionOrderItems.createdAt));
  }

  return {
    createOrder: async (companyId: string, input: CreateProductionOrder, userId: string | null) => {
      await assertProductInCompany(companyId, input.productId);
      for (const item of input.items) {
        await assertProductInCompany(companyId, item.productId);
      }
      const code = input.code ?? `OP-${Date.now().toString(36).toUpperCase()}`;
      const [order] = await db
        .insert(erpProductionOrders)
        .values({
          companyId,
          code,
          productId: input.productId,
          plannedQuantity: String(input.plannedQuantity),
          notes: input.notes ?? null,
          createdByUserId: userId,
        })
        .returning();
      for (const item of input.items) {
        await db.insert(erpProductionOrderItems).values({
          companyId,
          productionOrderId: order!.id,
          productId: item.productId,
          plannedQuantity: String(item.plannedQuantity),
          unitCostCents: item.unitCostCents ?? null,
        });
      }
      return { order, items: await loadItems(companyId, order!.id) };
    },

    listOrders: async (companyId: string) =>
      db
        .select()
        .from(erpProductionOrders)
        .where(eq(erpProductionOrders.companyId, companyId))
        .orderBy(desc(erpProductionOrders.createdAt)),

    getOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      return { order, items: await loadItems(companyId, orderId) };
    },

    startOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      if (!["planned", "released"].includes(order.status)) {
        throw conflict(`Production order cannot start from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpProductionOrders)
        .set({ status: "in_progress", startedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(erpProductionOrders.id, orderId), eq(erpProductionOrders.companyId, companyId)))
        .returning();
      return updated;
    },

    completeOrder: async (
      companyId: string,
      orderId: string,
      input: CompleteProductionOrder,
      actor: ProductionActor,
    ) => {
      const order = await loadOrder(companyId, orderId);
      if (!["in_progress", "released", "planned"].includes(order.status)) {
        throw conflict(`Production order cannot complete from status "${order.status}"`);
      }
      const items = await loadItems(companyId, orderId);

      // Validate material availability first (all-or-nothing on stock).
      for (const item of items) {
        const balance = await inventory.balance(companyId, item.productId);
        const needed = Number(item.plannedQuantity);
        if (balance.onHand < needed) {
          throw conflict(
            `Insufficient material ${item.productId} (balance ${balance.onHand}, need ${needed})`,
          );
        }
      }

      const consumptions = [];
      for (const item of items) {
        consumptions.push(
          await inventory.createMovement(
            companyId,
            {
              productId: item.productId,
              movementType: "outbound_shipment",
              quantity: Number(item.plannedQuantity),
              unitCostCents: item.unitCostCents,
              referenceType: "production_order",
              referenceId: orderId,
              note: `Consumo OP ${order.code}`,
            },
            actor,
          ),
        );
      }

      const production = await inventory.createMovement(
        companyId,
        {
          productId: order.productId,
          movementType: "inbound_receipt",
          quantity: input.outputQuantity,
          referenceType: "production_order",
          referenceId: orderId,
          note: `Produção OP ${order.code}`,
        },
        actor,
      );

      const [updated] = await db
        .update(erpProductionOrders)
        .set({
          status: "completed",
          completedAt: new Date(),
          notes: input.notes ?? order.notes,
          updatedAt: new Date(),
        })
        .where(and(eq(erpProductionOrders.id, orderId), eq(erpProductionOrders.companyId, companyId)))
        .returning();

      return { order: updated, consumptions, production };
    },

    cancelOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      if (!["planned", "released"].includes(order.status)) {
        throw conflict(`Production order cannot cancel from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpProductionOrders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(erpProductionOrders.id, orderId), eq(erpProductionOrders.companyId, companyId)))
        .returning();
      return updated;
    },
  };
}
