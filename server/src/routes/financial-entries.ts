/**
 * Financial entries routes — contas a pagar/receber (Paperclip ERP).
 *
 * Reads for any authenticated actor with company access; mutations (create,
 * update, settle) are board-managed and audited. Settlement posts ledger
 * events and is logged with the finance event id.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createErpPayableSchema,
  createErpReceivableSchema,
  settleFinancialEntrySchema,
  updateErpPayableSchema,
  updateErpReceivableSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { financialEntriesService, logActivity } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { badRequest } from "../errors.js";
import type { FinancialEntryListOptions } from "../services/financial-entries.js";

function parseListOptions(query: Record<string, unknown>): FinancialEntryListOptions {
  const limitRaw = query.limit;
  const limit = limitRaw == null || limitRaw === "" ? 100 : Number.parseInt(String(limitRaw), 10);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 500) throw badRequest("invalid 'limit'");
  const offsetRaw = query.offset;
  const offset = offsetRaw == null || offsetRaw === "" ? 0 : Number.parseInt(String(offsetRaw), 10);
  if (!Number.isFinite(offset) || offset < 0) throw badRequest("invalid 'offset'");
  return {
    status: typeof query.status === "string" && query.status ? query.status : undefined,
    from: typeof query.from === "string" && query.from ? query.from : undefined,
    to: typeof query.to === "string" && query.to ? query.to : undefined,
    limit,
    offset,
  };
}

export function financialEntriesRoutes(db: Db) {
  const router = Router();
  const entries = financialEntriesService(db);

  // --- Contas a pagar ---
  router.get("/companies/:companyId/erp/finance/payables", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await entries.listPayables(companyId, parseListOptions(req.query)));
  });

  router.post("/companies/:companyId/erp/finance/payables", validate(createErpPayableSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const row = await entries.createPayable(companyId, req.body, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.payable_created",
      entityType: "erp_payable",
      entityId: row.id,
      details: { amountCents: row.amountCents, dueDate: row.dueDate, status: row.status },
    });
    res.status(201).json(row);
  });

  router.patch("/companies/:companyId/erp/finance/payables/:id", validate(updateErpPayableSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const row = await entries.updatePayable(companyId, req.params.id as string, req.body);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.payable_updated",
      entityType: "erp_payable",
      entityId: row.id,
    });
    res.json(row);
  });

  router.post("/companies/:companyId/erp/finance/payables/:id/settle", validate(settleFinancialEntrySchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await entries.settlePayable(
      companyId,
      req.params.id as string,
      req.body,
      { actorType: actor.actorType, actorId: actor.actorId },
    );
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.payable_settled",
      entityType: "erp_payable",
      entityId: result.entry.id,
      details: { paidAmountCents: result.entry.paidAmountCents, financeEventId: result.financeEvent.id },
    });
    res.json(result);
  });

  // --- Contas a receber ---
  router.get("/companies/:companyId/erp/finance/receivables", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await entries.listReceivables(companyId, parseListOptions(req.query)));
  });

  router.post("/companies/:companyId/erp/finance/receivables", validate(createErpReceivableSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const row = await entries.createReceivable(companyId, req.body, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.receivable_created",
      entityType: "erp_receivable",
      entityId: row.id,
      details: { amountCents: row.amountCents, dueDate: row.dueDate, status: row.status },
    });
    res.status(201).json(row);
  });

  router.patch("/companies/:companyId/erp/finance/receivables/:id", validate(updateErpReceivableSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const row = await entries.updateReceivable(companyId, req.params.id as string, req.body);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.receivable_updated",
      entityType: "erp_receivable",
      entityId: row.id,
    });
    res.json(row);
  });

  router.post("/companies/:companyId/erp/finance/receivables/:id/settle", validate(settleFinancialEntrySchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await entries.settleReceivable(
      companyId,
      req.params.id as string,
      req.body,
      { actorType: actor.actorType, actorId: actor.actorId },
    );
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.receivable_settled",
      entityType: "erp_receivable",
      entityId: result.entry.id,
      details: { paidAmountCents: result.entry.paidAmountCents, financeEventId: result.financeEvent.id },
    });
    res.json(result);
  });

  return router;
}
