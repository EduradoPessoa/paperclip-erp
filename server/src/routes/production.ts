/**
 * PCP routes — Paperclip ERP.
 *
 * Reads for any authenticated actor with company access; order creation and
 * lifecycle actions (start/complete/cancel) are board-managed and audited.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { completeProductionOrderSchema, createProductionOrderSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logActivity, productionService } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import type { ProductionActor } from "../services/production.js";

function toProductionActor(actor: ReturnType<typeof getActorInfo>): ProductionActor {
  return { actorType: actor.actorType, actorId: actor.actorId };
}

export function productionRoutes(db: Db) {
  const router = Router();
  const production = productionService(db);

  router.get("/companies/:companyId/erp/production/orders", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await production.listOrders(companyId));
  });

  router.get("/companies/:companyId/erp/production/orders/:orderId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await production.getOrder(companyId, req.params.orderId as string));
  });

  router.post("/companies/:companyId/erp/production/orders", validate(createProductionOrderSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await production.createOrder(companyId, req.body, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.production_order_created",
      entityType: "erp_production_order",
      entityId: result.order.id,
      details: { code: result.order.code, productId: result.order.productId, itemCount: result.items.length },
    });
    res.status(201).json(result);
  });

  router.post("/companies/:companyId/erp/production/orders/:orderId/start", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const order = await production.startOrder(companyId, req.params.orderId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.production_order_started",
      entityType: "erp_production_order",
      entityId: order.id,
    });
    res.json(order);
  });

  router.post(
    "/companies/:companyId/erp/production/orders/:orderId/complete",
    validate(completeProductionOrderSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await production.completeOrder(
        companyId,
        req.params.orderId as string,
        req.body,
        toProductionActor(actor),
      );
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.production_order_completed",
        entityType: "erp_production_order",
        entityId: result.order.id,
        details: {
          outputQuantity: req.body.outputQuantity,
          consumptionCount: result.consumptions.length,
        },
      });
      res.json(result);
    },
  );

  router.post("/companies/:companyId/erp/production/orders/:orderId/cancel", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const order = await production.cancelOrder(companyId, req.params.orderId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.production_order_cancelled",
      entityType: "erp_production_order",
      entityId: order.id,
    });
    res.json(order);
  });

  return router;
}
