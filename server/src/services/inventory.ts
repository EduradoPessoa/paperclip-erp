/**
 * Estoques (inventory) service — Paperclip ERP.
 *
 * Movements are the source of truth; balance is the signed sum of deltas
 * (optionally per lot). Outbound/ship operations fail with 409 when the
 * balance would go negative. Fiscal receipt and sales shipment integrations
 * keep inventory linked to the commercial cycle.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  erpInventoryLots,
  erpInventoryMovements,
  erpProducts,
  fiscalDocuments,
  pipelineCases,
} from "@paperclipai/db";
import {
  inventoryDelta,
  type CreateInventoryMovement,
  type ReceiveFromFiscal,
  type ShipFromSales,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";

export interface InventoryActor {
  actorType: "user" | "agent" | "system";
  actorId: string;
}

export function inventoryService(db: Db) {
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

  async function balanceFor(companyId: string, productId: string, lotId?: string | null): Promise<number> {
    const conditions = [eq(erpInventoryMovements.companyId, companyId), eq(erpInventoryMovements.productId, productId)];
    if (lotId) conditions.push(eq(erpInventoryMovements.lotId, lotId));
    const [row] = await db
      .select({ balance: sql<number>`coalesce(sum(${erpInventoryMovements.deltaQuantity}), 0)::float8` })
      .from(erpInventoryMovements)
      .where(and(...conditions));
    return Number(row?.balance ?? 0);
  }

  async function resolveLot(companyId: string, productId: string, lotCode: string | null | undefined) {
    if (!lotCode) return null;
    const existing = await db
      .select()
      .from(erpInventoryLots)
      .where(
        and(
          eq(erpInventoryLots.companyId, companyId),
          eq(erpInventoryLots.productId, productId),
          eq(erpInventoryLots.lotCode, lotCode),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (existing) return existing;
    const [created] = await db
      .insert(erpInventoryLots)
      .values({ companyId, productId, lotCode })
      .returning();
    return created;
  }

  async function postMovement(input: {
    companyId: string;
    productId: string;
    movementType: CreateInventoryMovement["movementType"];
    quantity: number;
    lotId?: string | null;
    unitCostCents?: number | null;
    referenceType?: string | null;
    referenceId?: string | null;
    note?: string | null;
    actor: InventoryActor;
  }) {
    const delta = inventoryDelta(input.movementType, input.quantity);
    const [row] = await db
      .insert(erpInventoryMovements)
      .values({
        companyId: input.companyId,
        productId: input.productId,
        lotId: input.lotId ?? null,
        movementType: input.movementType,
        deltaQuantity: String(delta),
        unitCostCents: input.unitCostCents ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        note: input.note ?? null,
        createdByUserId: input.actor.actorType === "user" ? input.actor.actorId : null,
      })
      .returning();
    return {
      movement: row,
      balance: await balanceFor(input.companyId, input.productId, input.lotId ?? null),
      lotBalance: input.lotId ? await balanceFor(input.companyId, input.productId, input.lotId) : null,
    };
  }

  return {
    createMovement: async (companyId: string, input: CreateInventoryMovement, actor: InventoryActor) => {
      await assertProductInCompany(companyId, input.productId);
      const lot = await resolveLot(companyId, input.productId, input.lotCode);
      const delta = inventoryDelta(input.movementType, input.quantity);

      if (delta < 0) {
        const balance = await balanceFor(companyId, input.productId, lot?.id);
        if (balance + delta < 0) {
          throw conflict(`Insufficient stock for product ${input.productId} (balance ${balance})`);
        }
      }

      return postMovement({
        companyId,
        productId: input.productId,
        movementType: input.movementType,
        quantity: input.quantity,
        lotId: lot?.id,
        unitCostCents: input.unitCostCents,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        note: input.note,
        actor,
      });
    },

    receiveFromFiscal: async (companyId: string, input: ReceiveFromFiscal, actor: InventoryActor) => {
      const fiscal = await db
        .select()
        .from(fiscalDocuments)
        .where(and(eq(fiscalDocuments.id, input.fiscalDocumentId), eq(fiscalDocuments.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!fiscal) throw notFound("Fiscal document not found");
      if (fiscal.operationDirection !== "inbound") {
        throw unprocessable("Inventory receipt requires an inbound fiscal document");
      }

      const results = [];
      for (const item of input.items) {
        await assertProductInCompany(companyId, item.productId);
        const lot = await resolveLot(companyId, item.productId, item.lotCode);
        results.push(
          await postMovement({
            companyId,
            productId: item.productId,
            movementType: "inbound_receipt",
            quantity: item.quantity,
            lotId: lot?.id,
            unitCostCents: item.unitCostCents,
            referenceType: "fiscal_document",
            referenceId: fiscal.id,
            actor,
          }),
        );
      }
      return { movements: results };
    },

    shipFromSales: async (companyId: string, input: ShipFromSales, actor: InventoryActor) => {
      const order = await db
        .select()
        .from(pipelineCases)
        .where(and(eq(pipelineCases.id, input.salesOrderCaseId), eq(pipelineCases.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!order) throw notFound("Sales order not found");

      const results = [];
      for (const item of input.items) {
        await assertProductInCompany(companyId, item.productId);
        const lot = await resolveLot(companyId, item.productId, item.lotCode);
        const balance = await balanceFor(companyId, item.productId, lot?.id);
        if (balance < item.quantity) {
          throw conflict(`Insufficient stock for product ${item.productId} (balance ${balance}, need ${item.quantity})`);
        }
        results.push(
          await postMovement({
            companyId,
            productId: item.productId,
            movementType: "outbound_shipment",
            quantity: item.quantity,
            lotId: lot?.id,
            referenceType: "sales_order",
            referenceId: order.id,
            actor,
          }),
        );
      }
      return { movements: results };
    },

    balance: async (companyId: string, productId: string) => {
      await assertProductInCompany(companyId, productId);
      const onHand = await balanceFor(companyId, productId);
      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(erpInventoryMovements)
        .where(and(eq(erpInventoryMovements.companyId, companyId), eq(erpInventoryMovements.productId, productId)));
      return { companyId, productId, onHand, movementsCount: Number(countRow?.count ?? 0) };
    },

    listMovements: async (companyId: string, options: { productId?: string; limit: number; offset: number }) => {
      const conditions = [eq(erpInventoryMovements.companyId, companyId)];
      if (options.productId) conditions.push(eq(erpInventoryMovements.productId, options.productId));
      return db
        .select()
        .from(erpInventoryMovements)
        .where(and(...conditions))
        .orderBy(desc(erpInventoryMovements.createdAt))
        .limit(options.limit)
        .offset(options.offset);
    },

    listLots: async (companyId: string, productId?: string) => {
      const conditions = [eq(erpInventoryLots.companyId, companyId)];
      if (productId) conditions.push(eq(erpInventoryLots.productId, productId));
      const lots = await db
        .select()
        .from(erpInventoryLots)
        .where(and(...conditions))
        .orderBy(desc(erpInventoryLots.createdAt));
      return Promise.all(
        lots.map(async (lot) => ({
          ...lot,
          balance: await balanceFor(companyId, lot.productId, lot.id),
        })),
      );
    },
  };
}
