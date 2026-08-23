/**
 * Compras (purchasing) routes — Paperclip ERP.
 *
 * Purchase orders are pipeline cases with typed fields. Reads for any
 * authenticated actor with company access; order creation and goods receipt
 * (→ payable) are board-managed and audited.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { purchaseOrderFieldsSchema } from "@paperclipai/shared";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { logActivity, purchasingService } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { unauthorized, unprocessable } from "../errors.js";
import type { PurchasingActor } from "../services/purchasing.js";

const receiptSchema = z.object({ fiscalDocumentId: z.string().guid() });

function toPurchasingActor(actor: ReturnType<typeof getActorInfo>): PurchasingActor {
  if (actor.actorType === "agent") {
    if (!actor.agentId || !actor.runId) {
      throw unprocessable("Agent purchasing mutations require an active run", { code: "run_id_required" });
    }
    return { type: "agent", agentId: actor.agentId, runId: actor.runId };
  }
  if (actor.actorType === "user") {
    return { type: "user", userId: actor.actorId };
  }
  throw unauthorized();
}

export function purchasingRoutes(db: Db) {
  const router = Router();
  const purchasing = purchasingService(db);

  router.get("/companies/:companyId/erp/purchasing/orders", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await purchasing.listOrders(companyId));
  });

  router.get("/companies/:companyId/erp/purchasing/orders/:caseId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await purchasing.getOrder(companyId, req.params.caseId as string));
  });

  router.post(
    "/companies/:companyId/erp/purchasing/orders",
    validate(purchaseOrderFieldsSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const order = await purchasing.createOrder(companyId, req.body, toPurchasingActor(actor));
      const orderId = (order as { case?: { id: string } }).case?.id ?? (order as { id?: string }).id;
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.purchase_order_created",
        entityType: "pipeline_case",
        entityId: orderId ?? req.body.supplierId,
        details: { supplierId: req.body.supplierId, itemCount: req.body.items.length },
      });
      res.status(201).json(order);
    },
  );

  router.post(
    "/companies/:companyId/erp/purchasing/orders/:caseId/receipt",
    validate(receiptSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await purchasing.receiptFromFiscal(
        companyId,
        req.params.caseId as string,
        req.body.fiscalDocumentId,
        toPurchasingActor(actor),
      );
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.purchase_order_received",
        entityType: "pipeline_case",
        entityId: req.params.caseId as string,
        details: {
          fiscalDocumentId: req.body.fiscalDocumentId,
          payableId: result.payable.id,
          amountCents: result.payable.amountCents,
        },
      });
      res.json(result);
    },
  );

  return router;
}
