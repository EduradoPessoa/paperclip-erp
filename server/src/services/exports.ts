/**
 * Exportação service — Paperclip ERP.
 *
 * Export orders: declaration, incoterm/currency, and shipping that bills the
 * customer (receivable in the order currency).
 */

import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { erpCustomers, erpExportOrderItems, erpExportOrders, erpProducts } from "@paperclipai/db";
import type { CreateExportOrder } from "@paperclipai/shared";
import { exportOrderTotals } from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { financialEntriesService } from "./financial-entries.js";

export interface ExportActor {
  actorType: "user" | "agent" | "system";
  actorId: string;
}

export function exportOrdersService(db: Db) {
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

  async function assertProductsInCompany(companyId: string, items: Array<{ productId: string }>) {
    for (const item of items) {
      const row = await db
        .select({ id: erpProducts.id, companyId: erpProducts.companyId })
        .from(erpProducts)
        .where(eq(erpProducts.id, item.productId))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound(`Product "${item.productId}" not found`);
      if (row.companyId !== companyId) throw unprocessable("Product does not belong to company");
    }
  }

  async function loadOrder(companyId: string, orderId: string) {
    const row = await db
      .select()
      .from(erpExportOrders)
      .where(and(eq(erpExportOrders.id, orderId), eq(erpExportOrders.companyId, companyId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Export order not found");
    return row;
  }

  async function loadItems(companyId: string, orderId: string) {
    return db
      .select()
      .from(erpExportOrderItems)
      .where(
        and(
          eq(erpExportOrderItems.companyId, companyId),
          eq(erpExportOrderItems.exportOrderId, orderId),
        ),
      )
      .orderBy(asc(erpExportOrderItems.position));
  }

  return {
    createOrder: async (companyId: string, input: CreateExportOrder, userId: string | null) => {
      await assertCustomerInCompany(companyId, input.customerId);
      await assertProductsInCompany(companyId, input.items);
      const code = input.code ?? `EXP-${Date.now().toString(36).toUpperCase()}`;
      const [order] = await db
        .insert(erpExportOrders)
        .values({
          companyId,
          code,
          customerId: input.customerId,
          incoterm: input.incoterm ?? null,
          currency: input.currency,
          exchangeRateBps: input.exchangeRateBps ?? null,
          notes: input.notes ?? null,
          createdByUserId: userId,
        })
        .returning();
      for (const [index, item] of input.items.entries()) {
        await db.insert(erpExportOrderItems).values({
          companyId,
          exportOrderId: order!.id,
          productId: item.productId,
          position: index,
          quantity: String(item.quantity),
          unitPriceCents: item.unitPriceCents,
          totalCents: item.totalCents,
        });
      }
      const totalValueCents = exportOrderTotals(input.items);
      await db
        .update(erpExportOrders)
        .set({ totalValueCents })
        .where(eq(erpExportOrders.id, order!.id));
      return { order: { ...order, totalValueCents }, items: await loadItems(companyId, order!.id) };
    },

    listOrders: async (companyId: string) =>
      db
        .select()
        .from(erpExportOrders)
        .where(eq(erpExportOrders.companyId, companyId))
        .orderBy(desc(erpExportOrders.createdAt)),

    getOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      return { order, items: await loadItems(companyId, orderId) };
    },

    declareOrder: async (
      companyId: string,
      orderId: string,
      input: { documentNumber: string; documentDate?: string | null },
    ) => {
      const order = await loadOrder(companyId, orderId);
      if (order.status !== "draft") {
        throw conflict(`Export order cannot be declared from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpExportOrders)
        .set({
          status: "declared",
          documentNumber: input.documentNumber,
          documentDate: input.documentDate ? new Date(input.documentDate) : order.documentDate,
          updatedAt: new Date(),
        })
        .where(and(eq(erpExportOrders.id, orderId), eq(erpExportOrders.companyId, companyId)))
        .returning();
      return updated;
    },

    shipOrder: async (companyId: string, orderId: string, userId: string | null) => {
      const order = await loadOrder(companyId, orderId);
      if (!["declared", "draft"].includes(order.status)) {
        throw conflict(`Export order cannot ship from status "${order.status}"`);
      }

      const receivable = await entries.createReceivable(
        companyId,
        {
          customerId: order.customerId,
          fiscalDocumentId: null,
          description: `Exportação ${order.code}${order.documentNumber ? ` — ${order.documentNumber}` : ""}`,
          amountCents: order.totalValueCents ?? 0,
          currency: order.currency,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { exportOrderId: order.id, exchangeRateBps: order.exchangeRateBps },
        },
        userId,
      );

      const [updated] = await db
        .update(erpExportOrders)
        .set({ status: "shipped", shippedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(erpExportOrders.id, orderId), eq(erpExportOrders.companyId, companyId)))
        .returning();

      return { order: updated, receivable };
    },

    cancelOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      if (!["draft", "declared"].includes(order.status)) {
        throw conflict(`Export order cannot cancel from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpExportOrders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(erpExportOrders.id, orderId), eq(erpExportOrders.companyId, companyId)))
        .returning();
      return updated;
    },
  };
}
