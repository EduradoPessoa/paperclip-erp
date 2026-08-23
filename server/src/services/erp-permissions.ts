/**
 * ERP module RBAC enforcement — Paperclip ERP.
 *
 * Module-scoped permission keys (`erp:<module>:<action>`, e.g.
 * `erp:modules:manage`, `erp:purchasing:manage`) are checked against
 * `principal_permission_grants` for agent actors. Board actors keep full
 * control (humans govern the ERP) — the same posture as the board-only
 * mutation gates.
 */

import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { principalPermissionGrants } from "@paperclipai/db";
import { forbidden } from "../errors.js";

export interface ErpPermissionActor {
  type: "board" | "agent" | "user" | "none";
  agentId?: string | null;
}

/** Pure decision helper (exported for tests). */
export function decideErpPermission(input: { actorType: ErpPermissionActor["type"]; hasGrant: boolean }): boolean {
  if (input.actorType === "board") return true;
  if (input.actorType === "agent") return input.hasGrant;
  return false;
}

/**
 * Throws 403 when the actor is not allowed to perform the given ERP
 * permission. Board passes; agents require an active grant for the key in the
 * company.
 */
export async function assertErpPermission(
  db: Db,
  input: {
    companyId: string;
    actor: ErpPermissionActor;
    permissionKey: string;
  },
) {
  if (input.actor.type === "board") return;
  if (input.actor.type !== "agent") {
    throw forbidden(`ERP permission "${input.permissionKey}" requires an agent grant`);
  }
  const agentId = input.actor.agentId;
  if (!agentId) throw forbidden(`ERP permission "${input.permissionKey}" requires an agent identity`);

  const grant = await db
    .select({ id: principalPermissionGrants.id })
    .from(principalPermissionGrants)
    .where(
      and(
        eq(principalPermissionGrants.companyId, input.companyId),
        eq(principalPermissionGrants.principalType, "agent"),
        eq(principalPermissionGrants.principalId, agentId),
        eq(principalPermissionGrants.permissionKey, input.permissionKey),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!grant) {
    throw forbidden(`Agent lacks ERP permission "${input.permissionKey}"`);
  }
}
