/**
 * Vendas (sales) routes — Paperclip ERP.
 *
 * Sales orders are pipeline cases with typed fields. Reads for any
 * authenticated actor with company access; order creation and invoicing
 * (→ receivable) are board-managed and audited.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { salesOrderFieldsSchema } from "@paperclipai/shared";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { logActivity, salesService } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { unauthorized, unprocessable } from "../errors.js";
import type { SalesActor } from "../services/sales.js";

const invoiceSchema = z.object({ fiscalDocumentId: z.string().guid() });

function toSalesActor(actor: ReturnType<typeof getActorInfo>): SalesActor {
  if (actor.actorType === "agent") {
    if (!actor.agentId || !actor.runId) {
      throw unprocessable("Agent sales mutations require an active run", { code: "run_id_required" });
    }
    return { type: "agent", agentId: actor.agentId, runId: actor.runId };
  }
  if (actor.actorType === "user") {
    return { type: "user", userId: actor.actorId };
  }
  throw unauthorized();
}

export function salesRoutes(db: Db) {
  const router = Router();
  const sales = salesService(db);

  router.get("/companies/:companyId/erp/sales/orders", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await sales.listOrders(companyId));
  });

  router.get("/companies/:companyId/erp/sales/orders/:caseId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await sales.getOrder(companyId, req.params.caseId as string));
  });

  router.post(
    "/companies/:companyId/erp/sales/orders",
    validate(salesOrderFieldsSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const order = await sales.createOrder(companyId, req.body, toSalesActor(actor));
      const orderId = (order as { case?: { id: string } }).case?.id ?? (order as { id?: string }).id;
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.sales_order_created",
        entityType: "pipeline_case",
        entityId: orderId ?? req.body.customerId,
        details: { customerId: req.body.customerId, itemCount: req.body.items.length },
      });
      res.status(201).json(order);
    },
  );

  router.post(
    "/companies/:companyId/erp/sales/orders/:caseId/invoice",
    validate(invoiceSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await sales.invoiceFromFiscal(
        companyId,
        req.params.caseId as string,
        req.body.fiscalDocumentId,
        toSalesActor(actor),
      );
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.sales_order_invoiced",
        entityType: "pipeline_case",
        entityId: req.params.caseId as string,
        details: {
          fiscalDocumentId: req.body.fiscalDocumentId,
          receivableId: result.receivable.id,
          amountCents: result.receivable.amountCents,
        },
      });
      res.json(result);
    },
  );

  return router;
}
