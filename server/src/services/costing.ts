/**
 * Custo service — Paperclip ERP.
 *
 * Cost centers, period allocations (with source references) and production
 * cost: materials from the production order (planned × unit cost), labor and
 * overhead from allocations bound to the order.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  erpCostAllocations,
  erpCostCenters,
  erpProductionOrderItems,
  erpProductionOrders,
} from "@paperclipai/db";
import type { CreateCostAllocation, CreateCostCenter } from "@paperclipai/shared";
import { computeProductionCost } from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";

export interface CostingActor {
  actorType: "user" | "agent" | "system";
  actorId: string;
}

export function costingService(db: Db) {
  async function getCenter(companyId: string, costCenterId: string) {
    const row = await db
      .select()
      .from(erpCostCenters)
      .where(and(eq(erpCostCenters.id, costCenterId), eq(erpCostCenters.companyId, companyId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Cost center not found");
    return row;
  }

  return {
    // --- Cost centers ---
    listCenters: async (companyId: string) =>
      db
        .select()
        .from(erpCostCenters)
        .where(eq(erpCostCenters.companyId, companyId))
        .orderBy(asc(erpCostCenters.code)),

    createCenter: async (companyId: string, input: CreateCostCenter, userId: string | null) => {
      const code = input.code ?? `CC-${Date.now().toString(36).toUpperCase()}`;
      return db
        .insert(erpCostCenters)
        .values({ companyId, code, name: input.name, description: input.description ?? null, status: input.status, createdByUserId: userId })
        .returning()
        .then((rows) => rows[0]);
    },

    // --- Allocations ---
    createAllocation: async (companyId: string, input: CreateCostAllocation, userId: string | null) => {
      await getCenter(companyId, input.costCenterId);
      return db
        .insert(erpCostAllocations)
        .values({
          companyId,
          costCenterId: input.costCenterId,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          description: input.description,
          amountCents: input.amountCents,
          sourceType: input.sourceType ?? null,
          sourceId: input.sourceId ?? null,
          createdByUserId: userId,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    listAllocations: async (companyId: string, options: { costCenterId?: string; limit: number; offset: number }) => {
      const conditions = [eq(erpCostAllocations.companyId, companyId)];
      if (options.costCenterId) conditions.push(eq(erpCostAllocations.costCenterId, options.costCenterId));
      return db
        .select()
        .from(erpCostAllocations)
        .where(and(...conditions))
        .orderBy(desc(erpCostAllocations.createdAt))
        .limit(options.limit)
        .offset(options.offset);
    },

    // --- Production cost ---
    productionCost: async (companyId: string, productionOrderId: string) => {
      const order = await db
        .select()
        .from(erpProductionOrders)
        .where(and(eq(erpProductionOrders.id, productionOrderId), eq(erpProductionOrders.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!order) throw notFound("Production order not found");

      const items = await db
        .select()
        .from(erpProductionOrderItems)
        .where(
          and(
            eq(erpProductionOrderItems.companyId, companyId),
            eq(erpProductionOrderItems.productionOrderId, productionOrderId),
          ),
        );

      const materials = items.map((item) => ({
        quantity: Number(item.plannedQuantity),
        unitCostCents: item.unitCostCents ?? 0,
      }));

      const allocations = await db
        .select()
        .from(erpCostAllocations)
        .where(
          and(
            eq(erpCostAllocations.companyId, companyId),
            eq(erpCostAllocations.sourceType, "production_order"),
            eq(erpCostAllocations.sourceId, productionOrderId),
          ),
        );
      const laborCents = allocations.reduce((sum, a) => sum + a.amountCents, 0);

      const breakdown = computeProductionCost(materials, laborCents, 0);
      if (materials.length === 0) {
        throw unprocessable("Production order has no materials to cost");
      }
      return { order, breakdown };
    },
  };
}
