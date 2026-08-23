/**
 * Built-in fiscal provider registrations — Paperclip ERP.
 */

import { registerFiscalProviderFactory } from "./registry.js";
import { createSpedyProvider } from "./providers/spedy.js";

let registered = false;

/** Idempotent: registers the built-in providers shipped with the core. */
export function registerBuiltinFiscalProviders() {
  if (registered) return;
  registerFiscalProviderFactory("spedy", createSpedyProvider);
  registered = true;
}

export { registerFiscalProviderFactory, getFiscalProviderFactory, hasFiscalProviderFactory, listFiscalProviderKeys } from "./registry.js";
export type { FiscalProvider, ResolvedFiscalProviderConfig, FiscalProviderFactory } from "./provider.js";
