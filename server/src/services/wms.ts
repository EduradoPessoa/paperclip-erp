/**
 * WMS service — Paperclip ERP.
 *
 * Locations, per-location stock (derived from inventory movements with
 * referenceType "wms_location"), pick waves and cycle counts. Put-away/pick
 * post inventory movements; approving a cycle count posts an adjustment for
 * the difference.
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  erpInventoryMovements,
  erpWmsCycleCounts,
  erpWmsLocations,
  erpWmsPickWaves,
} from "@paperclipai/db";
import type {
  CreateCycleCount,
  CreatePickWave,
  CreateWmsLocation,
  Pick,
  PutAway,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { inventoryService, type InventoryActor } from "./inventory.js";

export interface WmsActor extends InventoryActor {}

const LOCATION_REF = "wms_location";

export function wmsService(db: Db) {
  const inventory = inventoryService(db);

  async function getLocation(companyId: string, locationId: string) {
    const row = await db
      .select()
      .from(erpWmsLocations)
      .where(and(eq(erpWmsLocations.id, locationId), eq(erpWmsLocations.companyId, companyId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("WMS location not found");
    return row;
  }

  async function stockAtLocation(companyId: string, locationId: string): Promise<number> {
    const [row] = await db
      .select({ balance: sql<number>`coalesce(sum(${erpInventoryMovements.deltaQuantity}), 0)::float8` })
      .from(erpInventoryMovements)
      .where(
        and(
          eq(erpInventoryMovements.companyId, companyId),
          eq(erpInventoryMovements.referenceType, LOCATION_REF),
          eq(erpInventoryMovements.referenceId, locationId),
        ),
      );
    return Number(row?.balance ?? 0);
  }

  async function pick(companyId: string, input: Pick, actor: WmsActor) {
    await getLocation(companyId, input.locationId);
    const available = await stockAtLocation(companyId, input.locationId);
    if (available < input.quantity) {
      throw conflict(`Insufficient stock at location ${input.locationId} (balance ${available})`);
    }
    return inventory.createMovement(
      companyId,
      {
        productId: input.productId,
        movementType: "transfer_out",
        quantity: input.quantity,
        referenceType: LOCATION_REF,
        referenceId: input.locationId,
        note: "WMS pick",
      },
      actor,
    );
  }

  return {
    // --- Locations ---
    listLocations: async (companyId: string) =>
      db
        .select()
        .from(erpWmsLocations)
        .where(eq(erpWmsLocations.companyId, companyId))
        .orderBy(asc(erpWmsLocations.code)),

    getLocation,

    createLocation: async (companyId: string, input: CreateWmsLocation, userId: string | null) =>
      db
        .insert(erpWmsLocations)
        .values({ companyId, ...input })
        .returning()
        .then((rows) => rows[0]),

    updateLocation: async (
      companyId: string,
      locationId: string,
      input: Partial<CreateWmsLocation>,
    ) => {
      const [row] = await db
        .update(erpWmsLocations)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(erpWmsLocations.id, locationId), eq(erpWmsLocations.companyId, companyId)))
        .returning();
      if (!row) throw notFound("WMS location not found");
      return row;
    },

    stock: async (companyId: string, locationId: string) => {
      const location = await getLocation(companyId, locationId);
      return { location, balance: await stockAtLocation(companyId, locationId) };
    },

    putAway: async (companyId: string, input: PutAway, actor: WmsActor) => {
      await getLocation(companyId, input.locationId);
      return inventory.createMovement(
        companyId,
        {
          productId: input.productId,
          movementType: "transfer_in",
          quantity: input.quantity,
          referenceType: LOCATION_REF,
          referenceId: input.locationId,
          note: "WMS put-away",
        },
        actor,
      );
    },

    pick: (companyId: string, input: Pick, actor: WmsActor) => pick(companyId, input, actor),

    // --- Pick waves ---
    createPickWave: async (companyId: string, input: CreatePickWave, userId: string | null) => {
      const code = input.code ?? `PW-${Date.now().toString(36).toUpperCase()}`;
      return db
        .insert(erpWmsPickWaves)
        .values({
          companyId,
          code,
          items: input.items,
          itemCount: input.items.length,
          createdByUserId: userId,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    listPickWaves: async (companyId: string) =>
      db
        .select()
        .from(erpWmsPickWaves)
        .where(eq(erpWmsPickWaves.companyId, companyId))
        .orderBy(desc(erpWmsPickWaves.createdAt)),

    completePickWave: async (companyId: string, waveId: string, actor: WmsActor) => {
      const wave = await db
        .select()
        .from(erpWmsPickWaves)
        .where(and(eq(erpWmsPickWaves.id, waveId), eq(erpWmsPickWaves.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!wave) throw notFound("Pick wave not found");
      if (wave.status !== "draft" && wave.status !== "active") {
        throw conflict(`Pick wave cannot be completed from status "${wave.status}"`);
      }

      const items = (wave.items ?? []) as Array<{ productId: string; quantity: number; locationId?: string | null }>;
      // Validate all items first so a failing wave does not partially pick.
      for (const item of items) {
        if (!item.locationId) throw unprocessable("Pick wave item requires a location");
        const available = await stockAtLocation(companyId, item.locationId);
        if (available < item.quantity) {
          throw conflict(
            `Insufficient stock at location ${item.locationId} for product ${item.productId} (balance ${available})`,
          );
        }
      }
      const picks = [];
      for (const item of items) {
        picks.push(
          await pick(companyId, {
            locationId: item.locationId!,
            productId: item.productId,
            quantity: item.quantity,
          }, actor),
        );
      }
      const [updated] = await db
        .update(erpWmsPickWaves)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(erpWmsPickWaves.id, waveId), eq(erpWmsPickWaves.companyId, companyId)))
        .returning();
      return { wave: updated, picks };
    },

    // --- Cycle counts ---
    createCycleCount: async (companyId: string, input: CreateCycleCount, userId: string | null) => {
      if (input.locationId) await getLocation(companyId, input.locationId);
      return db
        .insert(erpWmsCycleCounts)
        .values({
          companyId,
          locationId: input.locationId ?? null,
          productId: input.productId,
          countedQuantity: String(input.countedQuantity),
          notes: input.notes ?? null,
          countedAt: new Date(),
          createdByUserId: userId,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    listCycleCounts: async (companyId: string) =>
      db
        .select()
        .from(erpWmsCycleCounts)
        .where(eq(erpWmsCycleCounts.companyId, companyId))
        .orderBy(desc(erpWmsCycleCounts.createdAt)),

    approveCycleCount: async (companyId: string, countId: string, actor: WmsActor) => {
      const count = await db
        .select()
        .from(erpWmsCycleCounts)
        .where(and(eq(erpWmsCycleCounts.id, countId), eq(erpWmsCycleCounts.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!count) throw notFound("Cycle count not found");
      if (count.status !== "open") throw conflict("Cycle count is not open");

      const system = count.locationId
        ? await stockAtLocation(companyId, count.locationId)
        : await db
            .select({ balance: sql<number>`coalesce(sum(${erpInventoryMovements.deltaQuantity}), 0)::float8` })
            .from(erpInventoryMovements)
            .where(
              and(
                eq(erpInventoryMovements.companyId, companyId),
                eq(erpInventoryMovements.productId, count.productId),
              ),
            )
            .then((rows) => Number(rows[0]?.balance ?? 0));
      const counted = Number(count.countedQuantity);
      const difference = counted - system;

      let adjustment = null;
      if (difference !== 0) {
        adjustment = await inventory.createMovement(
          companyId,
          {
            productId: count.productId,
            movementType: "adjustment",
            quantity: difference,
            referenceType: count.locationId ? LOCATION_REF : null,
            referenceId: count.locationId ?? null,
            note: `Ajuste de inventário cíclico ${count.id}`,
          },
          actor,
        );
      }

      const [updated] = await db
        .update(erpWmsCycleCounts)
        .set({
          status: "approved",
          systemQuantity: String(system),
          difference: String(difference),
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(erpWmsCycleCounts.id, countId), eq(erpWmsCycleCounts.companyId, companyId)))
        .returning();
      return { cycleCount: updated, system, difference, adjustment };
    },
  };
}
