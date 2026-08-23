/**
 * Contabilidade routes — Paperclip ERP.
 *
 * Reads for any authenticated actor with company access; journal mutations
 * (create/post/reverse/cancel) are board-managed and audited.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createJournalEntrySchema, reverseJournalEntrySchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { accountingService, logActivity } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { badRequest } from "../errors.js";

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

export function accountingRoutes(db: Db) {
  const router = Router();
  const accounting = accountingService(db);

  router.get("/companies/:companyId/erp/accounting/journal-entries", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(
      await accounting.listEntries(companyId, {
        limit: parseLimit(req.query.limit),
        offset: parseOffset(req.query.offset),
      }),
    );
  });

  router.get("/companies/:companyId/erp/accounting/journal-entries/:entryId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await accounting.getEntry(companyId, req.params.entryId as string));
  });

  router.post("/companies/:companyId/erp/accounting/journal-entries", validate(createJournalEntrySchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await accounting.createEntry(companyId, req.body, actor.actorType === "user" ? actor.actorId : null);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.journal_entry_created",
      entityType: "erp_journal_entry",
      entityId: result.entry.id,
      details: { entryNumber: result.entry.entryNumber, lineCount: result.lines.length },
    });
    res.status(201).json(result);
  });

  router.post("/companies/:companyId/erp/accounting/journal-entries/:entryId/post", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const entry = await accounting.postEntry(companyId, req.params.entryId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.journal_entry_posted",
      entityType: "erp_journal_entry",
      entityId: entry.id,
    });
    res.json(entry);
  });

  router.post(
    "/companies/:companyId/erp/accounting/journal-entries/:entryId/reverse",
    validate(reverseJournalEntrySchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const entry = await accounting.reverseEntry(companyId, req.params.entryId as string, req.body.reason);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.journal_entry_reversed",
        entityType: "erp_journal_entry",
        entityId: entry.id,
      });
      res.json(entry);
    },
  );

  router.post("/companies/:companyId/erp/accounting/journal-entries/:entryId/cancel", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const entry = await accounting.cancelEntry(companyId, req.params.entryId as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.journal_entry_cancelled",
      entityType: "erp_journal_entry",
      entityId: entry.id,
    });
    res.json(entry);
  });

  return router;
}
