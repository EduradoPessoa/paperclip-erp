/**
 * Execution Center routes — Run Player timeline (V2).
 *
 * Reads are available to any authenticated actor with company access
 * (company-scoped visibility); timeline aggregation stays read-only.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { runTimelineService } from "../services/index.js";
import { assertAuthenticated, assertCompanyAccess } from "./authz.js";

export function executionRoutes(db: Db) {
  const router = Router();
  const timeline = runTimelineService(db);

  router.get("/companies/:companyId/runs/:runId/timeline", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await timeline.timeline(companyId, req.params.runId as string));
  });

  return router;
}
