/**
 * ERP module registry routes — Paperclip ERP.
 *
 * Reads for any authenticated actor with company access; install/uninstall/
 * update are board-managed and audited.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { installErpModuleSchema, updateErpModuleSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { assertErpPermission } from "../services/erp-permissions.js";
import { erpModuleService, logActivity } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function erpModuleRoutes(db: Db) {
  const router = Router();
  const modules = erpModuleService(db);

  router.get("/companies/:companyId/erp/modules", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await modules.list(companyId));
  });

  router.put(
    "/companies/:companyId/erp/modules",
    validate(installErpModuleSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      await assertErpPermission(db, { companyId, actor: req.actor, permissionKey: "erp:modules:manage" });
      const actor = getActorInfo(req);
      const module = await modules.install(companyId, req.body, {
        actorType: actor.actorType,
        actorId: actor.actorId,
      });
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.module_installed",
        entityType: "erp_module",
        entityId: module.id,
        details: { moduleKey: module.moduleKey, enabled: module.enabled },
      });
      res.json(module);
    },
  );

  router.patch(
    "/companies/:companyId/erp/modules/:moduleKey",
    validate(updateErpModuleSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      await assertErpPermission(db, { companyId, actor: req.actor, permissionKey: "erp:modules:manage" });
      const actor = getActorInfo(req);
      const module = await modules.update(companyId, req.params.moduleKey as never, req.body);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "erp.module_updated",
        entityType: "erp_module",
        entityId: module.id,
        details: { moduleKey: module.moduleKey, enabled: module.enabled },
      });
      res.json(module);
    },
  );

  router.delete("/companies/:companyId/erp/modules/:moduleKey", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    await assertErpPermission(db, { companyId, actor: req.actor, permissionKey: "erp:modules:manage" });
    const actor = getActorInfo(req);
    const result = await modules.uninstall(companyId, req.params.moduleKey as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "erp.module_uninstalled",
      entityType: "erp_module",
      entityId: req.params.moduleKey as string,
    });
    res.json(result);
  });

  return router;
}
