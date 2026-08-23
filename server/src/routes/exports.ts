/**
 * Exportação routes — Paperclip ERP.
 *
 * Reads for any authenticated actor with company access; mutations are
 * board-managed and audited.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createExportOrderSchema, declareExportOrderSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { exportOrdersService, logActivity } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function exportOrderRoutes(db: Db) {
  const router = Router();
  const exportsSvc = exportOrdersService(db);

  router.get("/companies/:companyId/erp/exports/orders", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await exportsSvc.listOrders(companyId));
  });

  router.get("/companies/:companyId/erp/exports/orders/:orderId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await exportsSvc.getOrder(companyId, req.params.orderId as string));
  });

  router.post("/companies/:companyId/erp/exports/orders", validate(createExportOrderSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await exportsSvc.createOrder(companyId, req.body, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.export_order_created",
      entityType: "erp_export_order",
      entityId: result.order.id,
      details: { code: result.order.code, customerId: result.order.customerId, currency: result.order.currency },
    });
    res.status(201).json(result);
  });

  router.post(
    "/companies/:companyId/erp/exports/orders/:orderId/declare",
    validate(declareExportOrderSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const order = await exportsSvc.declareOrder(companyId, req.params.orderId as string, req.body);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.export_order_declared",
        entityType: "erp_export_order",
        entityId: order.id,
        details: { documentNumber: order.documentNumber },
      });
      res.json(order);
    },
  );

  router.post("/companies/:companyId/erp/exports/orders/:orderId/ship", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await exportsSvc.shipOrder(companyId, req.params.orderId as string, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.export_order_shipped",
      entityType: "erp_export_order",
      entityId: result.order.id,
      details: { receivableId: result.receivable.id, currency: result.order.currency },
    });
    res.json(result);
  });

  router.post("/companies/:companyId/erp/exports/orders/:orderId/cancel", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const order = await exportsSvc.cancelOrder(companyId, req.params.orderId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.export_order_cancelled",
      entityType: "erp_export_order",
      entityId: order.id,
    });
    res.json(order);
  });

  return router;
}
