/**
 * Memory providers — Paperclip ERP (M2).
 */

import type { Db } from "@paperclipai/db";
import { registerMemoryProviderFactory } from "./registry.js";
import { createLocalTrailProvider } from "./providers/local-trail.js";

let registered = false;

/** Idempotent: registers the built-in memory providers shipped with the core. */
export function registerBuiltinMemoryProviders() {
  if (registered) return;
  registerMemoryProviderFactory("local_trail", createLocalTrailProvider);
  registered = true;
}

export {
  registerMemoryProviderFactory,
  getMemoryProviderFactory,
  hasMemoryProviderFactory,
  assertSupportedMemoryProviderKey,
} from "./registry.js";
export type { MemoryProviderFactory } from "./registry.js";
export type { MemoryProvider } from "@paperclipai/shared";
