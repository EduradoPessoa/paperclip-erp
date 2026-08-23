/**
 * Custo routes — Paperclip ERP.
 *
 * Reads for any authenticated actor with company access; center/allocation
 * mutations are board-managed and audited.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createCostAllocationSchema, createCostCenterSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { costingService, logActivity } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { badRequest } from "../errors.js";

function parseLimit(raw: unknown, fallback = 100) {
  if (raw == null || raw === "") return fallback;
  const limit = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 500) throw badRequest("invalid 'limit'");
  return limit;
}

function parseOffset(raw: unknown) {
  if (raw == null || raw === "") return 0;
  const offset = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(offset) || offset < 0) throw badRequest("invalid 'offset'");
  return offset;
}

export function costingRoutes(db: Db) {
  const router = Router();
  const costing = costingService(db);

  router.get("/companies/:companyId/erp/costing/cost-centers", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await costing.listCenters(companyId));
  });

  router.post("/companies/:companyId/erp/costing/cost-centers", validate(createCostCenterSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const center = await costing.createCenter(companyId, req.body, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.cost_center_created",
      entityType: "erp_cost_center",
      entityId: center.id,
      details: { code: center.code, name: center.name },
    });
    res.status(201).json(center);
  });

  router.get("/companies/:companyId/erp/costing/allocations", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    const costCenterId = typeof req.query.costCenterId === "string" ? req.query.costCenterId : undefined;
    res.json(
      await costing.listAllocations(companyId, {
        costCenterId,
        limit: parseLimit(req.query.limit),
        offset: parseOffset(req.query.offset),
      }),
    );
  });

  router.post("/companies/:companyId/erp/costing/allocations", validate(createCostAllocationSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const allocation = await costing.createAllocation(companyId, req.body, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.cost_allocation_created",
      entityType: "erp_cost_allocation",
      entityId: allocation.id,
      details: { costCenterId: allocation.costCenterId, amountCents: allocation.amountCents },
    });
    res.status(201).json(allocation);
  });

  router.get("/companies/:companyId/erp/costing/production-cost/:orderId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await costing.productionCost(companyId, req.params.orderId as string));
  });

  return router;
}
