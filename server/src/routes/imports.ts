/**
 * Importação routes — Paperclip ERP.
 *
 * Reads for any authenticated actor with company access; mutations are
 * board-managed and audited.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createImportOrderSchema, declareImportOrderSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { importOrdersService, logActivity } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function importOrderRoutes(db: Db) {
  const router = Router();
  const imports = importOrdersService(db);

  router.get("/companies/:companyId/erp/imports/orders", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await imports.listOrders(companyId));
  });

  router.get("/companies/:companyId/erp/imports/orders/:orderId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await imports.getOrder(companyId, req.params.orderId as string));
  });

  router.post("/companies/:companyId/erp/imports/orders", validate(createImportOrderSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await imports.createOrder(companyId, req.body, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.import_order_created",
      entityType: "erp_import_order",
      entityId: result.order.id,
      details: { code: result.order.code, supplierId: result.order.supplierId },
    });
    res.status(201).json(result);
  });

  router.post(
    "/companies/:companyId/erp/imports/orders/:orderId/declare",
    validate(declareImportOrderSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const order = await imports.declareOrder(companyId, req.params.orderId as string, req.body);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.import_order_declared",
        entityType: "erp_import_order",
        entityId: order.id,
        details: { documentNumber: order.documentNumber },
      });
      res.json(order);
    },
  );

  router.post("/companies/:companyId/erp/imports/orders/:orderId/clear", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await imports.clearOrder(companyId, req.params.orderId as string, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.import_order_cleared",
      entityType: "erp_import_order",
      entityId: result.order.id,
      details: { totalCostCents: result.order.totalCostCents, payableId: result.payable.id },
    });
    res.json(result);
  });

  router.post("/companies/:companyId/erp/imports/orders/:orderId/cancel", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const order = await imports.cancelOrder(companyId, req.params.orderId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.import_order_cancelled",
      entityType: "erp_import_order",
      entityId: order.id,
    });
    res.json(order);
  });

  return router;
}
