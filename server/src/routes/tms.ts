/**
 * TMS routes — Paperclip ERP.
 *
 * Reads for any authenticated actor with company access; freight order
 * lifecycle actions are board-managed and audited.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  addTrackingEventSchema,
  createFreightOrderSchema,
  linkFiscalDocumentSchema,
  scheduleFreightSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logActivity, tmsService } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import type { TmsActor } from "../services/tms.js";

function toTmsActor(actor: ReturnType<typeof getActorInfo>): TmsActor {
  return { actorType: actor.actorType, actorId: actor.actorId };
}

export function tmsRoutes(db: Db) {
  const router = Router();
  const tms = tmsService(db);

  router.get("/companies/:companyId/erp/tms/freight-orders", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await tms.listOrders(companyId));
  });

  router.get("/companies/:companyId/erp/tms/freight-orders/:orderId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await tms.getOrder(companyId, req.params.orderId as string));
  });

  router.post("/companies/:companyId/erp/tms/freight-orders", validate(createFreightOrderSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await tms.createOrder(companyId, req.body, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.freight_order_created",
      entityType: "erp_freight_order",
      entityId: result.order.id,
      details: { code: result.order.code, carrierName: result.order.carrierName },
    });
    res.status(201).json(result);
  });

  router.post(
    "/companies/:companyId/erp/tms/freight-orders/:orderId/schedule",
    validate(scheduleFreightSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const order = await tms.scheduleOrder(companyId, req.params.orderId as string, req.body.pickupAt);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.freight_order_scheduled",
        entityType: "erp_freight_order",
        entityId: order.id,
      });
      res.json(order);
    },
  );

  router.post("/companies/:companyId/erp/tms/freight-orders/:orderId/start", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const order = await tms.startShipment(companyId, req.params.orderId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.freight_order_started",
      entityType: "erp_freight_order",
      entityId: order.id,
    });
    res.json(order);
  });

  router.post(
    "/companies/:companyId/erp/tms/freight-orders/:orderId/tracking",
    validate(addTrackingEventSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await tms.addTrackingEvent(
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
        action: "erp.freight_tracking_event",
        entityType: "erp_freight_order",
        entityId: req.params.orderId as string,
        details: { status: req.body.status },
      });
      res.status(201).json(result);
    },
  );

  router.post("/companies/:companyId/erp/tms/freight-orders/:orderId/deliver", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const order = await tms.deliverOrder(companyId, req.params.orderId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.freight_order_delivered",
      entityType: "erp_freight_order",
      entityId: order.id,
    });
    res.json(order);
  });

  router.post(
    "/companies/:companyId/erp/tms/freight-orders/:orderId/link-fiscal",
    validate(linkFiscalDocumentSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const order = await tms.linkFiscalDocument(companyId, req.params.orderId as string, req.body.fiscalDocumentId);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.freight_order_linked_fiscal",
        entityType: "erp_freight_order",
        entityId: order.id,
        details: { fiscalDocumentId: req.body.fiscalDocumentId },
      });
      res.json(order);
    },
  );

  router.post("/companies/:companyId/erp/tms/freight-orders/:orderId/cancel", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const order = await tms.cancelOrder(companyId, req.params.orderId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.freight_order_cancelled",
      entityType: "erp_freight_order",
      entityId: order.id,
    });
    res.json(order);
  });

  return router;
}
