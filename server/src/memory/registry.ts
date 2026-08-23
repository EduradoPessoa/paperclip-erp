/**
 * Memory provider registry — Paperclip ERP (M2).
 *
 * Providers register by key (e.g. "local_trail"); the memory hooks resolve the
 * company/agent binding to a provider key and instantiate it via the
 * registered factory. External providers (mem0, etc.) arrive as adapters.
 */

import type { MemoryProvider, MemoryProviderKey } from "@paperclipai/shared";
import { unprocessable } from "../errors.js";
import type { Db } from "@paperclipai/db";

export type MemoryProviderFactory = (db: Db) => MemoryProvider;

const factories = new Map<string, MemoryProviderFactory>();

export function registerMemoryProviderFactory(key: string, factory: MemoryProviderFactory) {
  factories.set(key, factory);
}

export function getMemoryProviderFactory(key: string): MemoryProviderFactory {
  const factory = factories.get(key);
  if (!factory) {
    throw unprocessable(`Memory provider "${key}" is not registered`);
  }
  return factory;
}

export function hasMemoryProviderFactory(key: string): boolean {
  return factories.has(key);
}

export function assertSupportedMemoryProviderKey(key: string): asserts key is MemoryProviderKey {
  if (!hasMemoryProviderFactory(key)) {
    throw unprocessable(`Memory provider "${key}" is not supported`);
  }
}
