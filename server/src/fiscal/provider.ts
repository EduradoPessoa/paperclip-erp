/**
 * Fiscal provider contract — Paperclip ERP.
 *
 * The core never talks to SEFAZ/environments directly. Every fiscal
 * transmission goes through a `FiscalProvider` (gateway) bound to a company.
 * The contract lives in `@paperclipai/shared` so UI, plugins and adapters all
 * consume one definition; this file re-exports it for server imports.
 */

export type {
  FiscalProvider,
  FiscalProviderCapabilities,
  FiscalProviderBinding,
  FiscalProviderBindingConfig,
  FiscalEmitRequest,
  FiscalEmitResult,
  FiscalCancelRequest,
  FiscalCancelResult,
  FiscalInvalidateRequest,
  FiscalInvalidateResult,
  FiscalConsultRequest,
  FiscalStatusResult,
  FiscalDownloadRequest,
  FiscalDownloadResult,
  FiscalListEventsRequest,
  FiscalProviderEvent,
  FiscalDocumentItemInput,
  FiscalTaxLineInput,
  FiscalPartyInput,
  FiscalSplitPaymentInput,
} from "@paperclipai/shared";
export type { FiscalDocumentModel, FiscalEnvironment, FiscalProviderKey } from "@paperclipai/shared";
import type { FiscalProvider } from "@paperclipai/shared";

/** Runtime config handed to a provider factory after binding resolution. */
export interface ResolvedFiscalProviderConfig {
  baseUrl: string;
  environment: "homologation" | "production";
  /** Plain credential material for the provider (resolved from secrets in F2+). */
  apiKey?: string;
  extra?: Record<string, unknown>;
}

/** Factory: turns resolved config into a provider instance. */
export type FiscalProviderFactory = (config: ResolvedFiscalProviderConfig) => FiscalProvider;
