/**
 * OMS routes — Paperclip ERP.
 *
 * Reads for any authenticated actor with company access; mutations are
 * board-managed and audited.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createOmsOrderSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logActivity, omsService } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { unauthorized, unprocessable } from "../errors.js";
import type { OmsActor } from "../services/oms.js";

function toOmsActor(actor: ReturnType<typeof getActorInfo>): OmsActor {
  if (actor.actorType === "agent") {
    if (!actor.agentId || !actor.runId) {
      throw unprocessable("Agent OMS mutations require an active run", { code: "run_id_required" });
    }
    return { type: "agent", agentId: actor.agentId, runId: actor.runId };
  }
  if (actor.actorType === "user") {
    return { type: "user", userId: actor.actorId };
  }
  throw unauthorized();
}

export function omsRoutes(db: Db) {
  const router = Router();
  const oms = omsService(db);

  router.get("/companies/:companyId/erp/oms/orders", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await oms.listOrders(companyId));
  });

  router.get("/companies/:companyId/erp/oms/orders/:orderId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await oms.getOrder(companyId, req.params.orderId as string));
  });

  router.post("/companies/:companyId/erp/oms/orders", validate(createOmsOrderSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await oms.createOrder(companyId, req.body, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.oms_order_created",
      entityType: "erp_oms_order",
      entityId: result.order.id,
      details: { code: result.order.code, channel: result.order.channel },
    });
    res.status(201).json(result);
  });

  router.post("/companies/:companyId/erp/oms/orders/:orderId/confirm", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await oms.confirmOrder(companyId, req.params.orderId as string, toOmsActor(actor));
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.oms_order_confirmed",
      entityType: "erp_oms_order",
      entityId: result.order.id,
      details: { salesOrderCaseId: result.salesOrderCaseId },
    });
    res.json(result);
  });

  router.post("/companies/:companyId/erp/oms/orders/:orderId/ship", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const order = await oms.shipOrder(companyId, req.params.orderId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.oms_order_shipped",
      entityType: "erp_oms_order",
      entityId: order.id,
    });
    res.json(order);
  });

  router.post("/companies/:companyId/erp/oms/orders/:orderId/deliver", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const order = await oms.deliverOrder(companyId, req.params.orderId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.oms_order_delivered",
      entityType: "erp_oms_order",
      entityId: order.id,
    });
    res.json(order);
  });

  router.post("/companies/:companyId/erp/oms/orders/:orderId/cancel", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const order = await oms.cancelOrder(companyId, req.params.orderId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.oms_order_cancelled",
      entityType: "erp_oms_order",
      entityId: order.id,
    });
    res.json(order);
  });

  return router;
}
