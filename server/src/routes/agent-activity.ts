/**
 * Agent activity routes — acompanhamento de agentes (Paperclip ERP).
 *
 * Read-only, company-scoped feed of per-agent "today" indicators and recent
 * interactions. Any authenticated actor with company access can view it.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agentActivityService } from "../services/index.js";
import { assertAuthenticated, assertCompanyAccess } from "./authz.js";
import { badRequest } from "../errors.js";

function parseLimit(raw: unknown, fallback = 50) {
  if (raw == null || raw === "") return fallback;
  const limit = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 200) throw badRequest("invalid 'limit'");
  return limit;
}

export function agentActivityRoutes(db: Db) {
  const router = Router();
  const service = agentActivityService(db);

  router.get("/companies/:companyId/agents/activity-feed", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await service.feed(companyId, { limit: parseLimit(req.query.limit) }));
  });

  return router;
}
