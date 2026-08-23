/**
 * Importação service — Paperclip ERP.
 *
 * Import orders: declaration (DI/DUIMP), landed-cost allocation on clearing
 * (proportional to item values), product cost update and supplier payable.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  erpImportOrderItems,
  erpImportOrders,
  erpProducts,
  erpSuppliers,
} from "@paperclipai/db";
import {
  allocateImportCosts,
  type CreateImportOrder,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { financialEntriesService } from "./financial-entries.js";

export interface ImportActor {
  actorType: "user" | "agent" | "system";
  actorId: string;
}

export function importOrdersService(db: Db) {
  const entries = financialEntriesService(db);

  async function assertSupplierInCompany(companyId: string, supplierId: string) {
    const row = await db
      .select({ id: erpSuppliers.id, companyId: erpSuppliers.companyId })
      .from(erpSuppliers)
      .where(eq(erpSuppliers.id, supplierId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Supplier not found");
    if (row.companyId !== companyId) throw unprocessable("Supplier does not belong to company");
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
      .from(erpImportOrders)
      .where(and(eq(erpImportOrders.id, orderId), eq(erpImportOrders.companyId, companyId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Import order not found");
    return row;
  }

  async function loadItems(companyId: string, orderId: string) {
    return db
      .select()
      .from(erpImportOrderItems)
      .where(
        and(
          eq(erpImportOrderItems.companyId, companyId),
          eq(erpImportOrderItems.importOrderId, orderId),
        ),
      )
      .orderBy(asc(erpImportOrderItems.position));
  }

  return {
    createOrder: async (companyId: string, input: CreateImportOrder, userId: string | null) => {
      await assertSupplierInCompany(companyId, input.supplierId);
      await assertProductsInCompany(companyId, input.items);
      const code = input.code ?? `IMP-${Date.now().toString(36).toUpperCase()}`;
      const [order] = await db
        .insert(erpImportOrders)
        .values({
          companyId,
          code,
          supplierId: input.supplierId,
          documentNumber: input.documentNumber ?? null,
          documentDate: input.documentDate ? new Date(input.documentDate) : null,
          arrivalDate: input.arrivalDate ? new Date(input.arrivalDate) : null,
          freightCostCents: input.freightCostCents,
          insuranceCostCents: input.insuranceCostCents,
          exchangeRateBps: input.exchangeRateBps ?? null,
          notes: input.notes ?? null,
          createdByUserId: userId,
        })
        .returning();
      for (const [index, item] of input.items.entries()) {
        await db.insert(erpImportOrderItems).values({
          companyId,
          importOrderId: order!.id,
          productId: item.productId,
          position: index,
          quantity: String(item.quantity),
          invoiceValueCents: item.invoiceValueCents,
        });
      }
      return { order, items: await loadItems(companyId, order!.id) };
    },

    listOrders: async (companyId: string) =>
      db
        .select()
        .from(erpImportOrders)
        .where(eq(erpImportOrders.companyId, companyId))
        .orderBy(desc(erpImportOrders.createdAt)),

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
        throw conflict(`Import order cannot be declared from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpImportOrders)
        .set({
          status: "declared",
          documentNumber: input.documentNumber,
          documentDate: input.documentDate ? new Date(input.documentDate) : order.documentDate,
          updatedAt: new Date(),
        })
        .where(and(eq(erpImportOrders.id, orderId), eq(erpImportOrders.companyId, companyId)))
        .returning();
      return updated;
    },

    clearOrder: async (companyId: string, orderId: string, userId: string | null) => {
      const order = await loadOrder(companyId, orderId);
      if (order.status !== "declared") {
        throw conflict(`Import order cannot be cleared from status "${order.status}"`);
      }
      const items = await loadItems(companyId, orderId);

      const allocation = allocateImportCosts(
        items.map((item) => ({
          invoiceValueCents: item.invoiceValueCents,
          quantity: Number(item.quantity),
        })),
        { freightCostCents: order.freightCostCents, insuranceCostCents: order.insuranceCostCents },
      );

      for (const [index, item] of items.entries()) {
        const allocated = allocation.items[index]!.allocatedCostCents;
        const unitCostCents = Math.round(allocated / Number(item.quantity));
        await db
          .update(erpImportOrderItems)
          .set({ allocatedCostCents: allocated })
          .where(eq(erpImportOrderItems.id, item.id));
        await db
          .update(erpProducts)
          .set({ costCents: unitCostCents, updatedAt: new Date() })
          .where(and(eq(erpProducts.id, item.productId), eq(erpProducts.companyId, companyId)));
      }

      const payable = await entries.createPayable(
        companyId,
        {
          supplierId: order.supplierId,
          fiscalDocumentId: null,
          description: `Importação ${order.code}${order.documentNumber ? ` — ${order.documentNumber}` : ""}`,
          amountCents: allocation.totalCostCents,
          currency: "BRL",
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { importOrderId: order.id },
        },
        userId,
      );

      const [updated] = await db
        .update(erpImportOrders)
        .set({ status: "cleared", totalCostCents: allocation.totalCostCents, updatedAt: new Date() })
        .where(and(eq(erpImportOrders.id, orderId), eq(erpImportOrders.companyId, companyId)))
        .returning();

      return { order: updated, allocation, payable };
    },

    cancelOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      if (!["draft", "declared"].includes(order.status)) {
        throw conflict(`Import order cannot cancel from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpImportOrders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(erpImportOrders.id, orderId), eq(erpImportOrders.companyId, companyId)))
        .returning();
      return updated;
    },
  };
}
