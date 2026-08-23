/**
 * Ativo Imobilizado routes — Paperclip ERP.
 *
 * Reads for any authenticated actor with company access; mutations are
 * board-managed and audited.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createFixedAssetSchema,
  disposeFixedAssetSchema,
  runDepreciationSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { fixedAssetsService, logActivity } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function fixedAssetRoutes(db: Db) {
  const router = Router();
  const assets = fixedAssetsService(db);

  router.get("/companies/:companyId/erp/fixed-assets", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await assets.listAssets(companyId));
  });

  router.get("/companies/:companyId/erp/fixed-assets/:assetId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await assets.getAsset(companyId, req.params.assetId as string));
  });

  router.post("/companies/:companyId/erp/fixed-assets", validate(createFixedAssetSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await assets.createAsset(companyId, req.body, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.fixed_asset_created",
      entityType: "erp_fixed_asset",
      entityId: result.asset.id,
      details: { code: result.asset.code, name: result.asset.name },
    });
    res.status(201).json(result);
  });

  router.post(
    "/companies/:companyId/erp/fixed-assets/:assetId/depreciate",
    validate(runDepreciationSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await assets.runDepreciation(
        companyId,
        req.params.assetId as string,
        req.body.periodEnd,
        actor.actorType === "user" ? actor.actorId : null,
      );
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.fixed_asset_depreciated",
        entityType: "erp_fixed_asset",
        entityId: result.asset.id,
        details: { depreciationCents: result.run?.depreciationCents ?? 0, bookValueCents: result.asset.bookValueCents },
      });
      res.json(result);
    },
  );

  router.post(
    "/companies/:companyId/erp/fixed-assets/:assetId/dispose",
    validate(disposeFixedAssetSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const asset = await assets.disposeAsset(
        companyId,
        req.params.assetId as string,
        req.body,
        actor.actorType === "user" ? actor.actorId : null,
      );
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.fixed_asset_disposed",
        entityType: "erp_fixed_asset",
        entityId: asset.id,
        details: { disposalValueCents: asset.disposalValueCents },
      });
      res.json(asset);
    },
  );

  router.post("/companies/:companyId/erp/fixed-assets/:assetId/cancel", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const asset = await assets.cancelAsset(companyId, req.params.assetId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.fixed_asset_cancelled",
      entityType: "erp_fixed_asset",
      entityId: asset.id,
    });
    res.json(asset);
  });

  return router;
}
