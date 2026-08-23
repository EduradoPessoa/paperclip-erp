/**
 * ERP module registry service — Paperclip ERP.
 *
 * Company-scoped module manifests: list installed modules, install (upsert by
 * moduleKey), uninstall, enable/disable. Future phases map pipelines, case
 * types, routines and skills to each module key.
 */

import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { erpModules } from "@paperclipai/db";
import type { ErpModuleKey, InstallErpModule, UpdateErpModule } from "@paperclipai/shared";
import { ERP_MODULE_LABELS } from "@paperclipai/shared";
import { notFound } from "../errors.js";

export interface ErpModuleActor {
  actorType: "user" | "agent" | "system";
  actorId: string;
}

export function erpModuleService(db: Db) {
  return {
    list: async (companyId: string) =>
      db
        .select()
        .from(erpModules)
        .where(eq(erpModules.companyId, companyId))
        .orderBy(asc(erpModules.moduleKey)),

    install: async (companyId: string, input: InstallErpModule, actor: ErpModuleActor) => {
      const key = input.moduleKey;
      const [row] = await db
        .insert(erpModules)
        .values({
          companyId,
          moduleKey: key,
          name: input.name ?? ERP_MODULE_LABELS[key],
          enabled: input.enabled,
          config: input.config,
          installedByUserId: actor.actorType === "user" ? actor.actorId : null,
        })
        .onConflictDoUpdate({
          target: [erpModules.companyId, erpModules.moduleKey],
          set: {
            name: input.name ?? ERP_MODULE_LABELS[key],
            enabled: input.enabled,
            config: input.config,
            updatedAt: new Date(),
          },
        })
        .returning();
      return row;
    },

    update: async (companyId: string, moduleKey: ErpModuleKey, input: UpdateErpModule) => {
      const [row] = await db
        .update(erpModules)
        .set({
          enabled: input.enabled,
          config: input.config,
          updatedAt: new Date(),
        })
        .where(and(eq(erpModules.companyId, companyId), eq(erpModules.moduleKey, moduleKey)))
        .returning();
      if (!row) throw notFound(`ERP module "${moduleKey}" not installed`);
      return row;
    },

    uninstall: async (companyId: string, moduleKey: string) => {
      const [row] = await db
        .delete(erpModules)
        .where(and(eq(erpModules.companyId, companyId), eq(erpModules.moduleKey, moduleKey)))
        .returning();
      if (!row) throw notFound(`ERP module "${moduleKey}" not installed`);
      return { ok: true };
    },
  };
}
