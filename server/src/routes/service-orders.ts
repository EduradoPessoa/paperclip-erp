/**
 * Serviços (service orders) routes — Paperclip ERP.
 *
 * Reads for any authenticated actor with company access; order creation and
 * lifecycle actions are board-managed and audited.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  completeServiceOrderSchema,
  createServiceOrderSchema,
  scheduleServiceOrderSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logActivity, serviceOrdersService } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function serviceOrderRoutes(db: Db) {
  const router = Router();
  const serviceOrders = serviceOrdersService(db);

  router.get("/companies/:companyId/erp/services/orders", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await serviceOrders.listOrders(companyId));
  });

  router.get("/companies/:companyId/erp/services/orders/:orderId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await serviceOrders.getOrder(companyId, req.params.orderId as string));
  });

  router.post("/companies/:companyId/erp/services/orders", validate(createServiceOrderSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await serviceOrders.createOrder(
      companyId,
      req.body,
      actor.actorType === "user" ? actor.actorId : null,
    );
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.service_order_created",
      entityType: "erp_service_order",
      entityId: result.order.id,
      details: { code: result.order.code, customerId: result.order.customerId },
    });
    res.status(201).json(result);
  });

  router.post(
    "/companies/:companyId/erp/services/orders/:orderId/schedule",
    validate(scheduleServiceOrderSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const order = await serviceOrders.scheduleOrder(companyId, req.params.orderId as string, req.body.scheduledAt);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.service_order_scheduled",
        entityType: "erp_service_order",
        entityId: order.id,
      });
      res.json(order);
    },
  );

  router.post("/companies/:companyId/erp/services/orders/:orderId/start", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const order = await serviceOrders.startOrder(companyId, req.params.orderId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.service_order_started",
      entityType: "erp_service_order",
      entityId: order.id,
    });
    res.json(order);
  });

  router.post(
    "/companies/:companyId/erp/services/orders/:orderId/complete",
    validate(completeServiceOrderSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await serviceOrders.completeOrder(
        companyId,
        req.params.orderId as string,
        req.body,
        actor.actorType === "user" ? actor.actorId : null,
      );
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.service_order_completed",
        entityType: "erp_service_order",
        entityId: result.order.id,
        details: { totalCents: result.totalCents, receivableId: result.receivable.id },
      });
      res.json(result);
    },
  );

  router.post("/companies/:companyId/erp/services/orders/:orderId/cancel", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const order = await serviceOrders.cancelOrder(companyId, req.params.orderId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.service_order_cancelled",
      entityType: "erp_service_order",
      entityId: order.id,
    });
    res.json(order);
  });

  return router;
}
