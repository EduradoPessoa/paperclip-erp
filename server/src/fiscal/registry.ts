/**
 * Fiscal provider registry — Paperclip ERP.
 *
 * Providers register by key (e.g. "spedy"); the fiscal service resolves the
 * company binding to a provider key and instantiates it via the registered
 * factory. This keeps the core integrator-agnostic: a new gateway is a new
 * factory registration, with no route/UI/service changes.
 */

import type { FiscalProvider, FiscalProviderKey } from "@paperclipai/shared";
import { unprocessable } from "../errors.js";
import type { FiscalProviderFactory } from "./provider.js";

const factories = new Map<string, FiscalProviderFactory>();

export function registerFiscalProviderFactory(key: string, factory: FiscalProviderFactory) {
  factories.set(key, factory);
}

export function getFiscalProviderFactory(key: string): FiscalProviderFactory {
  const factory = factories.get(key);
  if (!factory) {
    throw unprocessable(`Fiscal provider "${key}" is not registered`);
  }
  return factory;
}

export function hasFiscalProviderFactory(key: string): boolean {
  return factories.has(key);
}

export function listFiscalProviderKeys(): string[] {
  return [...factories.keys()];
}

export function assertSupportedFiscalProviderKey(key: string): asserts key is FiscalProviderKey {
  if (!hasFiscalProviderFactory(key)) {
    throw unprocessable(`Fiscal provider "${key}" is not supported`);
  }
}

export type { FiscalProvider, FiscalProviderKey } from "@paperclipai/shared";
