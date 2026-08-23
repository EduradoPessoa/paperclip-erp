/**
 * Execution memory control plane — Paperclip ERP.
 *
 * Paperclip owns bindings (company default + agent override), resolution,
 * provenance and the audited operation trail; memory providers own
 * extraction/storage/ranking. See `doc/plans/2026-03-17-memory-service-surface-api.md`.
 */

import type {
  MemoryOperationStatus,
  MemoryOperationType,
  MemoryProviderKey,
  MemoryTargetType,
} from "../constants.js";

export interface MemoryScope {
  companyId: string;
  agentId?: string | null;
  projectId?: string | null;
  issueId?: string | null;
  runId?: string | null;
  subjectId?: string | null;
  sessionKey?: string | null;
  namespace?: string | null;
}

export type MemorySourceKind =
  | "issue_comment"
  | "issue_document"
  | "issue"
  | "run"
  | "activity"
  | "manual_note"
  | "external_document"
  | "case_event";

export interface MemorySourceRef {
  kind: MemorySourceKind;
  issueId?: string | null;
  commentId?: string | null;
  documentKey?: string | null;
  runId?: string | null;
  activityId?: string | null;
  externalRef?: string | null;
  caseId?: string | null;
}

export interface MemoryBinding {
  id: string;
  companyId: string;
  bindingKey: string;
  providerKey: string;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryBindingTarget {
  id: string;
  companyId: string;
  bindingId: string;
  targetType: MemoryTargetType;
  targetId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryOperation {
  id: string;
  companyId: string;
  bindingId: string;
  operationType: MemoryOperationType;
  scope: MemoryScope;
  sourceRef: MemorySourceRef | null;
  providerRecordId: string | null;
  status: MemoryOperationStatus;
  error: string | null;
  latencyMs: number | null;
  usage: Record<string, unknown> | null;
  runId: string | null;
  costEventId: string | null;
  createdAt: string;
}

export interface MemoryExtractionJob {
  id: string;
  companyId: string;
  bindingId: string;
  operationId: string;
  providerJobId: string | null;
  hookKind: string | null;
  status: string;
  sourceRef: MemorySourceRef | null;
  error: string | null;
  submittedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface MemoryProviderCapabilities {
  capture: boolean;
  query: boolean;
  list: boolean;
  get: boolean;
  forget: boolean;
  profile?: boolean;
}

export interface MemoryCaptureRecord {
  text: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface MemoryCaptureInput {
  companyId: string;
  bindingId: string;
  scope: MemoryScope;
  sourceRef: MemorySourceRef | null;
  records: MemoryCaptureRecord[];
  actorType: string;
  actorUserId: string | null;
  actorAgentId: string | null;
  runId: string | null;
}

export interface MemoryCaptureOutput {
  recordIds: string[];
}

export interface MemoryQueryInput {
  companyId: string;
  scope: MemoryScope;
  query: string;
  topK?: number;
}

export interface MemoryQueryOutput {
  snippets: Array<{ handle: string; text: string; score?: number | null }>;
}

/**
 * A memory provider implements storage/extraction semantics. Paperclip owns
 * bindings, resolution, provenance and the operation trail; the provider owns
 * extraction/ranking/storage (M2: local trail provider records operations;
 * external providers like mem0 arrive as adapters).
 */
export interface MemoryProvider {
  key: MemoryProviderKey;
  capabilities: MemoryProviderCapabilities;
  capture(input: MemoryCaptureInput): Promise<MemoryCaptureOutput>;
  query(input: MemoryQueryInput): Promise<MemoryQueryOutput>;
}
