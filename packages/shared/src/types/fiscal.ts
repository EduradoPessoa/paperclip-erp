/**
 * Fiscal module contract — Paperclip ERP.
 *
 * The fiscal module emits and manages Brazilian electronic tax documents
 * (NF-e, NFC-e, NFS-e, CT-e, MDF-e and future DF-e) through an
 * **integrator-agnostic** provider contract. The core owns bindings, company
 * scope, audit events and provenance; the provider owns SEFAZ/environment
 * communication and layout updates (Notas Técnicas, IBS/CBS/IS).
 *
 * This mirrors the MemoryAdapter pattern: a stable, small contract that any
 * gateway (SPEDY first, others later) can implement without core changes.
 */

import type {
  FiscalDocumentModel,
  FiscalEnvironment,
  FiscalProviderKey,
  FiscalTaxType,
} from "../constants.js";

/** One fiscal line item (product/service). */
export interface FiscalDocumentItemInput {
  /** NCM (products) or service code (NFS-e). */
  ncm?: string | null;
  /** CEST when required. */
  cest?: string | null;
  /** CFOP for the operation. */
  cfop?: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  totalCents: number;
  taxes?: FiscalTaxLineInput[];
}

/** One tax line on a document or item. */
export interface FiscalTaxLineInput {
  taxType: FiscalTaxType;
  baseCents: number;
  rateBps: number; // basis points (10000 = 100%)
  amountCents: number;
  creditable: boolean;
}

/** Emitter / receiver party data. */
export interface FiscalPartyInput {
  name: string;
  /** CPF or CNPJ, digits only. */
  taxId: string;
  /** Municipal taxpayer id (NFS-e) when applicable. */
  municipalTaxId?: string | null;
  /** State taxpayer id (IE) when applicable. */
  stateTaxId?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}

/** Split payment (reforma tributária) data carried on the document. */
export interface FiscalSplitPaymentInput {
  enabled: boolean;
  /** IBS+CBS portion to be withheld at settlement, in cents. */
  withheldCents: number;
  /** Estimated split rates in basis points (IBS/CBS). */
  rateBps?: number | null;
}

/** Payload for `FiscalProvider.emit`. */
export interface FiscalEmitRequest {
  companyId: string;
  documentId: string;
  model: FiscalDocumentModel;
  environment: FiscalEnvironment;
  /** Access key (chave de acesso) — idempotency key per document. */
  accessKey: string;
  number: number;
  series: number;
  operationDirection: "inbound" | "outbound";
  emitter: FiscalPartyInput;
  receiver?: FiscalPartyInput | null;
  items: FiscalDocumentItemInput[];
  totalsCents: number;
  taxes: FiscalTaxLineInput[];
  splitPayment?: FiscalSplitPaymentInput | null;
  /** Free-form provider-specific extras (kept out of core contract). */
  providerExtras?: Record<string, unknown>;
}

export interface FiscalEmitResult {
  /** Provider-native document id. */
  providerDocumentId: string;
  status: "transmitted" | "authorized" | "rejected" | "denied" | "error";
  /** Provider message / protocol note. */
  message?: string | null;
  /** Authorization protocol when already authorized. */
  protocol?: string | null;
  /** Official signed XML when the provider returns it synchronously. */
  signedXml?: string | null;
  providerRaw?: Record<string, unknown>;
}

export interface FiscalCancelRequest {
  companyId: string;
  documentId: string;
  providerDocumentId: string;
  accessKey: string;
  justification: string;
  environment: FiscalEnvironment;
}

export interface FiscalCancelResult {
  status: "cancelled" | "error";
  protocol?: string | null;
  message?: string | null;
  providerRaw?: Record<string, unknown>;
}

export interface FiscalInvalidateRequest {
  companyId: string;
  documentId: string;
  model: FiscalDocumentModel;
  environment: FiscalEnvironment;
  number: number;
  series: number;
  justification: string;
}

export interface FiscalInvalidateResult {
  status: "invalidated" | "error";
  protocol?: string | null;
  message?: string | null;
  providerRaw?: Record<string, unknown>;
}

export interface FiscalConsultRequest {
  companyId: string;
  documentId: string;
  providerDocumentId: string;
  accessKey: string;
  environment: FiscalEnvironment;
}

export interface FiscalStatusResult {
  status: FiscalEmitResult["status"] | "cancelled" | "invalidated";
  protocol?: string | null;
  message?: string | null;
  signedXml?: string | null;
  providerRaw?: Record<string, unknown>;
}

export interface FiscalDownloadRequest {
  companyId: string;
  documentId: string;
  providerDocumentId: string;
  accessKey: string;
  environment: FiscalEnvironment;
}

export interface FiscalDownloadResult {
  content: Uint8Array;
  contentType: string;
  filename: string;
}

export interface FiscalProviderEvent {
  kind: string;
  occurredAt: string;
  message?: string | null;
  payload?: Record<string, unknown>;
}

export interface FiscalListEventsRequest {
  companyId: string;
  documentId: string;
  providerDocumentId: string;
  accessKey: string;
  environment: FiscalEnvironment;
}

export interface FiscalProviderCapabilities {
  documentModels: FiscalDocumentModel[];
  danfe: boolean;
  webhooks: boolean;
  splitPayment: boolean;
}

/**
 * A fiscal integrator (gateway) implementation. The core never talks to
 * SEFAZ/environments directly — every transmission goes through a provider
 * bound to the company.
 */
export interface FiscalProvider {
  key: FiscalProviderKey;
  capabilities: FiscalProviderCapabilities;
  emit(req: FiscalEmitRequest): Promise<FiscalEmitResult>;
  cancel(req: FiscalCancelRequest): Promise<FiscalCancelResult>;
  invalidate(req: FiscalInvalidateRequest): Promise<FiscalInvalidateResult>;
  consult(req: FiscalConsultRequest): Promise<FiscalStatusResult>;
  downloadXml(req: FiscalDownloadRequest): Promise<FiscalDownloadResult>;
  downloadDanfe(req: FiscalDownloadRequest): Promise<FiscalDownloadResult>;
  listEvents(req: FiscalListEventsRequest): Promise<FiscalProviderEvent[]>;
}

/**
 * Company-scoped binding config. Sensitive values (API keys, certificates)
 * are always `company_secrets` refs — never inline plain values.
 */
export interface FiscalProviderBindingConfig {
  baseUrl?: string;
  apiKeySecretRef?: string;
  certificateSecretRef?: string;
  environment: FiscalEnvironment;
  /** Provider-specific extras (e.g. SPEDY account/cnpj). */
  extra?: Record<string, unknown>;
}

export interface FiscalProviderBinding {
  id: string;
  companyId: string;
  providerKey: FiscalProviderKey;
  /** Models this binding serves; empty = all supported by the provider. */
  documentModels: FiscalDocumentModel[];
  config: FiscalProviderBindingConfig;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
