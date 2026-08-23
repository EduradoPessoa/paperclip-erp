/**
 * Serviços (service orders) service — Paperclip ERP.
 *
 * Service orders with scheduling, SLA and priced items. Completing an order
 * creates the receivable (billing) linked to the customer.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { erpCustomers, erpServiceOrderItems, erpServiceOrders } from "@paperclipai/db";
import type {
  CompleteServiceOrder,
  CreateServiceOrder,
  ServiceOrderItem,
} from "@paperclipai/shared";
import { serviceOrderTotals } from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { financialEntriesService } from "./financial-entries.js";

export interface ServiceOrderActor {
  actorType: "user" | "agent" | "system";
  actorId: string;
}

export function serviceOrdersService(db: Db) {
  const entries = financialEntriesService(db);

  async function assertCustomerInCompany(companyId: string, customerId: string) {
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
      .from(erpServiceOrders)
      .where(and(eq(erpServiceOrders.id, orderId), eq(erpServiceOrders.companyId, companyId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Service order not found");
    return row;
  }

  async function loadItems(companyId: string, orderId: string) {
    return db
      .select()
      .from(erpServiceOrderItems)
      .where(
        and(
          eq(erpServiceOrderItems.companyId, companyId),
          eq(erpServiceOrderItems.serviceOrderId, orderId),
        ),
      )
      .orderBy(asc(erpServiceOrderItems.position));
  }

  return {
    createOrder: async (companyId: string, input: CreateServiceOrder, userId: string | null) => {
      await assertCustomerInCompany(companyId, input.customerId);
      const code = input.code ?? `OS-${Date.now().toString(36).toUpperCase()}`;
      const [order] = await db
        .insert(erpServiceOrders)
        .values({
          companyId,
          code,
          customerId: input.customerId,
          title: input.title,
          description: input.description ?? null,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : null,
          createdByUserId: userId,
        })
        .returning();
      for (const [index, item] of input.items.entries()) {
        await db.insert(erpServiceOrderItems).values({
          companyId,
          serviceOrderId: order!.id,
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
        .from(erpServiceOrders)
        .where(eq(erpServiceOrders.companyId, companyId))
        .orderBy(desc(erpServiceOrders.createdAt)),

    getOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      return { order, items: await loadItems(companyId, orderId) };
    },

    scheduleOrder: async (companyId: string, orderId: string, scheduledAt: string) => {
      const order = await loadOrder(companyId, orderId);
      if (!["open", "scheduled"].includes(order.status)) {
        throw conflict(`Service order cannot be scheduled from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpServiceOrders)
        .set({ status: "scheduled", scheduledAt: new Date(scheduledAt), updatedAt: new Date() })
        .where(and(eq(erpServiceOrders.id, orderId), eq(erpServiceOrders.companyId, companyId)))
        .returning();
      return updated;
    },

    startOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      if (!["open", "scheduled"].includes(order.status)) {
        throw conflict(`Service order cannot start from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpServiceOrders)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(and(eq(erpServiceOrders.id, orderId), eq(erpServiceOrders.companyId, companyId)))
        .returning();
      return updated;
    },

    completeOrder: async (
      companyId: string,
      orderId: string,
      input: CompleteServiceOrder,
      userId: string | null,
    ) => {
      const order = await loadOrder(companyId, orderId);
      if (!["in_progress", "scheduled", "open"].includes(order.status)) {
        throw conflict(`Service order cannot complete from status "${order.status}"`);
      }
      const items = await loadItems(companyId, orderId);
      const totals = serviceOrderTotals(
        items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPriceCents: item.unitPriceCents,
          totalCents: item.totalCents,
        })),
      );

      const receivable = await entries.createReceivable(
        companyId,
        {
          customerId: order.customerId,
          fiscalDocumentId: null,
          description: `Ordem de serviço ${order.code} — ${order.title}`,
          amountCents: totals,
          currency: "BRL",
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { serviceOrderId: order.id },
        },
        userId,
      );

      const [updated] = await db
        .update(erpServiceOrders)
        .set({
          status: "completed",
          completedAt: new Date(),
          slaMet: input.slaMet ?? null,
          notes: input.notes ?? order.notes,
          updatedAt: new Date(),
        })
        .where(and(eq(erpServiceOrders.id, orderId), eq(erpServiceOrders.companyId, companyId)))
        .returning();

      return { order: updated, receivable, totalCents: totals };
    },

    cancelOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      if (!["open", "scheduled", "in_progress"].includes(order.status)) {
        throw conflict(`Service order cannot cancel from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpServiceOrders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(erpServiceOrders.id, orderId), eq(erpServiceOrders.companyId, companyId)))
        .returning();
      return updated;
    },
  };
}
