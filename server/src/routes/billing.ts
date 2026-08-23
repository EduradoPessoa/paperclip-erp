/**
 * Faturamento (billing) routes — Paperclip ERP.
 *
 * Invoice emission is board-managed (human-in-the-loop before transmitting to
 * SEFAZ) and audited; reads are company-scoped and authenticated.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createBillingInvoiceSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { billingService, logActivity } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { badRequest } from "../errors.js";
import type { BillingActor } from "../services/billing.js";

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

function toBillingActor(actor: ReturnType<typeof getActorInfo>): BillingActor {
  return {
    actorType: actor.actorType,
    actorId: actor.actorId,
    agentId: actor.agentId,
    runId: actor.runId,
  };
}

export function billingRoutes(db: Db) {
  const router = Router();
  const billing = billingService(db);

  router.get("/companies/:companyId/erp/billing/invoices", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json(
      await billing.listInvoices(companyId, {
        status,
        limit: parseLimit(req.query.limit),
        offset: parseOffset(req.query.offset),
      }),
    );
  });

  router.get("/companies/:companyId/erp/billing/invoices/:documentId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await billing.getInvoice(companyId, req.params.documentId as string));
  });

  router.post(
    "/companies/:companyId/erp/billing/invoices",
    validate(createBillingInvoiceSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await billing.invoiceFromSalesOrder(companyId, req.body, toBillingActor(actor));
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.billing_invoice_emitted",
        entityType: "fiscal_document",
        entityId: result.fiscalDocument.document.id,
        details: {
          salesOrderCaseId: req.body.salesOrderCaseId,
          authorized: result.authorized,
          receivableId: result.receivable?.id ?? null,
        },
      });
      res.status(201).json(result);
    },
  );

  return router;
}
