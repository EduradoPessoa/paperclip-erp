/**
 * Ativo Imobilizado service — Paperclip ERP.
 *
 * Fixed asset cards with linear depreciation runs (append-only per period).
 * A run accumulates depreciation until the book value reaches the salvage
 * value; then the asset is marked depreciated. Disposal records the
 * disposal value.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { erpDepreciationRuns, erpFixedAssets } from "@paperclipai/db";
import type { CreateFixedAsset } from "@paperclipai/shared";
import { computeDepreciation } from "@paperclipai/shared";
import { conflict, notFound } from "../errors.js";

export interface FixedAssetActor {
  actorType: "user" | "agent" | "system";
  actorId: string;
}

export function fixedAssetsService(db: Db) {
  async function loadAsset(companyId: string, assetId: string) {
    const row = await db
      .select()
      .from(erpFixedAssets)
      .where(and(eq(erpFixedAssets.id, assetId), eq(erpFixedAssets.companyId, companyId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Fixed asset not found");
    return row;
  }

  async function loadRuns(companyId: string, assetId: string) {
    return db
      .select()
      .from(erpDepreciationRuns)
      .where(
        and(
          eq(erpDepreciationRuns.companyId, companyId),
          eq(erpDepreciationRuns.assetId, assetId),
        ),
      )
      .orderBy(asc(erpDepreciationRuns.periodEnd));
  }

  return {
    createAsset: async (companyId: string, input: CreateFixedAsset, userId: string | null) => {
      const code = input.code ?? `AT-${Date.now().toString(36).toUpperCase()}`;
      const [asset] = await db
        .insert(erpFixedAssets)
        .values({
          companyId,
          code,
          name: input.name,
          category: input.category ?? null,
          acquisitionDate: new Date(input.acquisitionDate),
          acquisitionCostCents: input.acquisitionCostCents,
          usefulLifeMonths: input.usefulLifeMonths,
          salvageValueCents: input.salvageValueCents,
          bookValueCents: input.acquisitionCostCents,
          notes: input.notes ?? null,
          createdByUserId: userId,
        })
        .returning();
      return { asset, runs: await loadRuns(companyId, asset!.id) };
    },

    listAssets: async (companyId: string) =>
      db
        .select()
        .from(erpFixedAssets)
        .where(eq(erpFixedAssets.companyId, companyId))
        .orderBy(desc(erpFixedAssets.createdAt)),

    getAsset: async (companyId: string, assetId: string) => {
      const asset = await loadAsset(companyId, assetId);
      return { asset, runs: await loadRuns(companyId, assetId) };
    },

    runDepreciation: async (companyId: string, assetId: string, periodEnd: string, userId: string | null) => {
      const asset = await loadAsset(companyId, assetId);
      if (asset.status !== "active") {
        throw conflict(`Depreciation requires an active asset (status "${asset.status}")`);
      }

      const computation = computeDepreciation({
        acquisitionCostCents: asset.acquisitionCostCents,
        salvageValueCents: asset.salvageValueCents,
        usefulLifeMonths: asset.usefulLifeMonths,
        accumulatedDepreciationCents: asset.accumulatedDepreciationCents,
      });

      if (computation.nextDepreciationCents <= 0) {
        const [updated] = await db
          .update(erpFixedAssets)
          .set({ status: "depreciated", updatedAt: new Date() })
          .where(and(eq(erpFixedAssets.id, assetId), eq(erpFixedAssets.companyId, companyId)))
          .returning();
        return { asset: updated, run: null, computation };
      }

      const [run] = await db
        .insert(erpDepreciationRuns)
        .values({
          companyId,
          assetId,
          periodEnd: new Date(periodEnd),
          depreciationCents: computation.nextDepreciationCents,
          bookValueAfterCents: computation.bookValueAfterCents,
          createdByUserId: userId,
        })
        .returning();

      const [updated] = await db
        .update(erpFixedAssets)
        .set({
          accumulatedDepreciationCents: asset.accumulatedDepreciationCents + computation.nextDepreciationCents,
          bookValueCents: computation.bookValueAfterCents,
          status: computation.fullyDepreciated ? "depreciated" : "active",
          updatedAt: new Date(),
        })
        .where(and(eq(erpFixedAssets.id, assetId), eq(erpFixedAssets.companyId, companyId)))
        .returning();

      return { asset: updated, run, computation };
    },

    disposeAsset: async (
      companyId: string,
      assetId: string,
      input: { disposalValueCents: number; notes?: string | null },
      userId: string | null,
    ) => {
      const asset = await loadAsset(companyId, assetId);
      if (asset.status !== "active" && asset.status !== "depreciated") {
        throw conflict(`Asset cannot be disposed from status "${asset.status}"`);
      }
      const [updated] = await db
        .update(erpFixedAssets)
        .set({
          status: "disposed",
          disposedAt: new Date(),
          disposalValueCents: input.disposalValueCents,
          notes: input.notes ?? asset.notes,
          updatedAt: new Date(),
        })
        .where(and(eq(erpFixedAssets.id, assetId), eq(erpFixedAssets.companyId, companyId)))
        .returning();
      return updated;
    },

    cancelAsset: async (companyId: string, assetId: string) => {
      const asset = await loadAsset(companyId, assetId);
      if (asset.status !== "active") {
        throw conflict(`Asset cannot be cancelled from status "${asset.status}"`);
      }
      const runs = await loadRuns(companyId, assetId);
      if (runs.length > 0) {
        throw conflict("Assets with depreciation runs cannot be cancelled");
      }
      const [updated] = await db
        .update(erpFixedAssets)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(erpFixedAssets.id, assetId), eq(erpFixedAssets.companyId, companyId)))
        .returning();
      return updated;
    },
  };
}
