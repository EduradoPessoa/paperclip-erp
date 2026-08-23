import type { DashboardSummary } from "@paperclipai/shared";
import { api } from "./client";

/** Decorated live run row returned by GET /companies/:companyId/live-runs. */
export interface ExecutionLiveRun {
  id: string;
  status: string;
  invocationSource: string;
  triggerDetail: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  agentId: string;
  agentName: string;
  adapterType: string;
  logBytes: number | null;
  livenessState?: string | null;
  livenessReason?: string | null;
  nextAction?: string | null;
  lastUsefulActionAt?: string | null;
  issueId?: string | null;
  currentToolName?: string | null;
  currentStatusMessage?: string | null;
  lastAssistantSnippet?: string | null;
  lastEventAt?: string | null;
  outputSilence?: {
    silentForSec?: number | null;
    maxSilentForSec?: number | null;
    status?: string | null;
    at?: string | null;
  } | null;
}

/** Row from GET /companies/:companyId/review-cases (human review queue). */
export interface ExecutionReviewCase {
  case: {
    id: string;
    pipelineId: string;
    stageId: string;
    caseKey: string | null;
    title: string;
    updatedAt: string;
  };
  pipeline: {
    id: string;
    key: string | null;
    name: string;
  };
  stage: {
    id: string;
    key: string;
    name: string;
    kind: string;
  };
  pendingSuggestion: {
    toStageKey: string;
    rationale: string;
    confidence?: number | null;
    suggestedByAgentId?: string | null;
  } | null;
}

export interface ExecutionFiscalQueue {
  counts: Record<string, number>;
}

export const executionApi = {
  liveRuns: (companyId: string, limit = 50) =>
    api.get<ExecutionLiveRun[]>(`/companies/${companyId}/live-runs?limit=${limit}`),
  dashboard: (companyId: string) =>
    api.get<DashboardSummary>(`/companies/${companyId}/dashboard`),
  reviewCases: (companyId: string) =>
    api.get<ExecutionReviewCase[]>(`/companies/${companyId}/review-cases`),
  fiscalQueue: (companyId: string) =>
    api.get<ExecutionFiscalQueue>(`/companies/${companyId}/fiscal/queue?limit=1`),
};
