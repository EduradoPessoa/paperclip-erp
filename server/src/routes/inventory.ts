/**
 * Estoques (inventory) routes — Paperclip ERP.
 *
 * Reads for any authenticated actor with company access; mutations (movements,
 * receive-from-fiscal, ship-from-sales) are board-managed and audited.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createInventoryMovementSchema,
  receiveFromFiscalSchema,
  shipFromSalesSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { inventoryService, logActivity } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { badRequest } from "../errors.js";
import type { InventoryActor } from "../services/inventory.js";

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

function toInventoryActor(actor: ReturnType<typeof getActorInfo>): InventoryActor {
  return { actorType: actor.actorType, actorId: actor.actorId };
}

export function inventoryRoutes(db: Db) {
  const router = Router();
  const inventory = inventoryService(db);

  router.get("/companies/:companyId/erp/inventory/movements", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    res.json(
      await inventory.listMovements(companyId, {
        productId,
        limit: parseLimit(req.query.limit),
        offset: parseOffset(req.query.offset),
      }),
    );
  });

  router.post(
    "/companies/:companyId/erp/inventory/movements",
    validate(createInventoryMovementSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await inventory.createMovement(companyId, req.body, toInventoryActor(actor));
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.inventory_movement",
        entityType: "erp_inventory_movement",
        entityId: result.movement.id,
        details: {
          productId: result.movement.productId,
          movementType: result.movement.movementType,
          deltaQuantity: result.movement.deltaQuantity,
          balance: result.balance,
        },
      });
      res.status(201).json(result);
    },
  );

  router.get("/companies/:companyId/erp/inventory/balance", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    if (!productId) throw badRequest("productId is required");
    res.json(await inventory.balance(companyId, productId));
  });

  router.get("/companies/:companyId/erp/inventory/lots", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    res.json(await inventory.listLots(companyId, productId));
  });

  router.post(
    "/companies/:companyId/erp/inventory/receive-from-fiscal",
    validate(receiveFromFiscalSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await inventory.receiveFromFiscal(companyId, req.body, toInventoryActor(actor));
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.inventory_received_from_fiscal",
        entityType: "fiscal_document",
        entityId: req.body.fiscalDocumentId,
        details: { itemCount: result.movements.length },
      });
      res.status(201).json(result);
    },
  );

  router.post(
    "/companies/:companyId/erp/inventory/ship-from-sales",
    validate(shipFromSalesSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await inventory.shipFromSales(companyId, req.body, toInventoryActor(actor));
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.inventory_shipped_from_sales",
        entityType: "pipeline_case",
        entityId: req.body.salesOrderCaseId,
        details: { itemCount: result.movements.length },
      });
      res.status(201).json(result);
    },
  );

  return router;
}
