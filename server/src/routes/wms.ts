/**
 * WMS routes — Paperclip ERP.
 *
 * Reads for any authenticated actor with company access; mutations (locations,
 * put-away, pick, pick waves, cycle counts) are board-managed and audited.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createCycleCountSchema,
  createPickWaveSchema,
  createWmsLocationSchema,
  pickSchema,
  putAwaySchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logActivity, wmsService } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import type { WmsActor } from "../services/wms.js";

function toWmsActor(actor: ReturnType<typeof getActorInfo>): WmsActor {
  return { actorType: actor.actorType, actorId: actor.actorId };
}

export function wmsRoutes(db: Db) {
  const router = Router();
  const wms = wmsService(db);

  router.get("/companies/:companyId/erp/wms/locations", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await wms.listLocations(companyId));
  });

  router.post("/companies/:companyId/erp/wms/locations", validate(createWmsLocationSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const location = await wms.createLocation(companyId, req.body, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.wms_location_created",
      entityType: "erp_wms_location",
      entityId: location.id,
      details: { code: location.code },
    });
    res.status(201).json(location);
  });

  router.get("/companies/:companyId/erp/wms/locations/:locationId/stock", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await wms.stock(companyId, req.params.locationId as string));
  });

  router.post("/companies/:companyId/erp/wms/put-away", validate(putAwaySchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await wms.putAway(companyId, req.body, toWmsActor(actor));
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.wms_put_away",
      entityType: "erp_inventory_movement",
      entityId: result.movement.id,
      details: { locationId: req.body.locationId, productId: req.body.productId },
    });
    res.status(201).json(result);
  });

  router.post("/companies/:companyId/erp/wms/pick", validate(pickSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await wms.pick(companyId, req.body, toWmsActor(actor));
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.wms_pick",
      entityType: "erp_inventory_movement",
      entityId: result.movement.id,
      details: { locationId: req.body.locationId, productId: req.body.productId },
    });
    res.status(201).json(result);
  });

  router.get("/companies/:companyId/erp/wms/pick-waves", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await wms.listPickWaves(companyId));
  });

  router.post("/companies/:companyId/erp/wms/pick-waves", validate(createPickWaveSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const wave = await wms.createPickWave(companyId, req.body, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.wms_pick_wave_created",
      entityType: "erp_wms_pick_wave",
      entityId: wave.id,
      details: { code: wave.code, itemCount: wave.itemCount },
    });
    res.status(201).json(wave);
  });

  router.post("/companies/:companyId/erp/wms/pick-waves/:waveId/complete", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await wms.completePickWave(companyId, req.params.waveId as string, toWmsActor(actor));
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.wms_pick_wave_completed",
      entityType: "erp_wms_pick_wave",
      entityId: result.wave.id,
      details: { code: result.wave.code, pickCount: result.picks.length },
    });
    res.json(result);
  });

  router.get("/companies/:companyId/erp/wms/cycle-counts", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await wms.listCycleCounts(companyId));
  });

  router.post("/companies/:companyId/erp/wms/cycle-counts", validate(createCycleCountSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const count = await wms.createCycleCount(companyId, req.body, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.wms_cycle_count_created",
      entityType: "erp_wms_cycle_count",
      entityId: count.id,
      details: { productId: count.productId, countedQuantity: count.countedQuantity },
    });
    res.status(201).json(count);
  });

  router.post("/companies/:companyId/erp/wms/cycle-counts/:countId/approve", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await wms.approveCycleCount(companyId, req.params.countId as string, toWmsActor(actor));
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.wms_cycle_count_approved",
      entityType: "erp_wms_cycle_count",
      entityId: result.cycleCount.id,
      details: { system: result.system, difference: result.difference },
    });
    res.json(result);
  });

  return router;
}
