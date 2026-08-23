/**
 * ERP permission key conventions — Paperclip ERP.
 *
 * Module-scoped grants follow the stable naming `erp:<moduleKey>:<action>`
 * (e.g. `erp:purchasing:approve`, `erp:fiscal:transmit`). Core permission
 * enforcement lands together with the first module routes; these helpers keep
 * the convention typed and validated from day one.
 */

import type { ErpModuleKey } from "./constants.js";

export const ERP_PERMISSION_PREFIX = "erp:" as const;

/** Builds `erp:<moduleKey>:<action>` (e.g. "erp:purchasing:approve"). */
export function buildErpModulePermission(moduleKey: ErpModuleKey, action: string): string {
  return `${ERP_PERMISSION_PREFIX}${moduleKey}:${action}`;
}

/** True for any `erp:`-prefixed permission key. */
export function isErpPermissionKey(key: string): boolean {
  return key.startsWith(ERP_PERMISSION_PREFIX);
}
