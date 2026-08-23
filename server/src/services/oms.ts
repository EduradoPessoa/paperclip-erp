/**
 * OMS service — Paperclip ERP.
 *
 * Multi-channel order lifecycle with delivery promise. Confirming an order
 * with a customer creates the sales order (Vendas) so billing/fiscal flow
 * continues; items without a product are skipped from the sales order.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { erpCustomers, erpOmsOrderItems, erpOmsOrders } from "@paperclipai/db";
import type { CreateOmsOrder } from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { salesService, type SalesActor } from "./sales.js";

export interface OmsActor extends SalesActor {}

export function omsService(db: Db) {
  const sales = salesService(db);

  async function assertCustomerInCompany(companyId: string, customerId: string | null | undefined) {
    if (!customerId) return;
    const row = await db
      .select({ id: erpCustomers.id, companyId: erpCustomers.companyId })
      .from(erpCustomers)
      .where(eq(erpCustomers.id, customerId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Customer not found");
    if (row.companyId !== companyId) throw unprocessable("Customer does not belong to company");
  }

  async function loadOrder(companyId: string, orderId: string) {
    const row = await db
      .select()
      .from(erpOmsOrders)
      .where(and(eq(erpOmsOrders.id, orderId), eq(erpOmsOrders.companyId, companyId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("OMS order not found");
    return row;
  }

  async function loadItems(companyId: string, orderId: string) {
    return db
      .select()
      .from(erpOmsOrderItems)
      .where(and(eq(erpOmsOrderItems.companyId, companyId), eq(erpOmsOrderItems.omsOrderId, orderId)))
      .orderBy(asc(erpOmsOrderItems.position));
  }

  return {
    createOrder: async (companyId: string, input: CreateOmsOrder, userId: string | null) => {
      await assertCustomerInCompany(companyId, input.customerId);
      const code = input.code ?? `OMS-${Date.now().toString(36).toUpperCase()}`;
      const [order] = await db
        .insert(erpOmsOrders)
        .values({
          companyId,
          code,
          channel: input.channel,
          externalOrderId: input.externalOrderId ?? null,
          customerId: input.customerId ?? null,
          promiseAt: input.promiseAt ? new Date(input.promiseAt) : null,
          notes: input.notes ?? null,
          createdByUserId: userId,
        })
        .returning();
      for (const [index, item] of input.items.entries()) {
        await db.insert(erpOmsOrderItems).values({
          companyId,
          omsOrderId: order!.id,
          productId: item.productId ?? null,
          position: index,
          description: item.description,
          quantity: String(item.quantity),
          unitPriceCents: item.unitPriceCents,
          totalCents: item.totalCents,
        });
      }
      return { order, items: await loadItems(companyId, order!.id) };
    },

    listOrders: async (companyId: string) =>
      db
        .select()
        .from(erpOmsOrders)
        .where(eq(erpOmsOrders.companyId, companyId))
        .orderBy(desc(erpOmsOrders.createdAt)),

    getOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      return { order, items: await loadItems(companyId, orderId) };
    },

    confirmOrder: async (companyId: string, orderId: string, actor: OmsActor) => {
      const order = await loadOrder(companyId, orderId);
      if (order.status !== "received") {
        throw conflict(`OMS order cannot be confirmed from status "${order.status}"`);
      }
      const items = await loadItems(companyId, orderId);

      // Create the sales order when a customer is set and at least one item
      // has a product; billing/fiscal continue in Vendas.
      let salesOrderCaseId: string | null = null;
      if (order.customerId) {
        const productItems = items.filter((item) => item.productId);
        if (productItems.length > 0) {
          const salesOrder = await sales.createOrder(
            companyId,
            {
              customerId: order.customerId,
              customerName: undefined,
              items: productItems.map((item) => ({
                productId: item.productId!,
                description: item.description,
                quantity: Number(item.quantity),
                unit: "UN",
                unitPriceCents: item.unitPriceCents,
                totalCents: item.totalCents,
              })),
            },
            { type: actor.type, userId: actor.userId ?? null, agentId: actor.agentId ?? null, runId: actor.runId ?? null },
          );
          salesOrderCaseId = (salesOrder as { case?: { id: string } }).case?.id ?? (salesOrder as { id?: string }).id ?? null;
        }
      }

      const [updated] = await db
        .update(erpOmsOrders)
        .set({
          status: "confirmed",
          salesOrderCaseId,
          metadata: { ...order.metadata, salesOrderCreated: Boolean(salesOrderCaseId) },
          updatedAt: new Date(),
        })
        .where(and(eq(erpOmsOrders.id, orderId), eq(erpOmsOrders.companyId, companyId)))
        .returning();
      return { order: updated, salesOrderCaseId };
    },

    shipOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      if (order.status !== "confirmed") {
        throw conflict(`OMS order cannot ship from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpOmsOrders)
        .set({ status: "shipped", shippedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(erpOmsOrders.id, orderId), eq(erpOmsOrders.companyId, companyId)))
        .returning();
      return updated;
    },

    deliverOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      if (order.status !== "shipped") {
        throw conflict(`OMS order cannot be delivered from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpOmsOrders)
        .set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() })
        .where(and(eq(erpOmsOrders.id, orderId), eq(erpOmsOrders.companyId, companyId)))
        .returning();
      return updated;
    },

    cancelOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      if (["delivered", "cancelled"].includes(order.status)) {
        throw conflict(`OMS order cannot cancel from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpOmsOrders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(erpOmsOrders.id, orderId), eq(erpOmsOrders.companyId, companyId)))
        .returning();
      return updated;
    },
  };
}
