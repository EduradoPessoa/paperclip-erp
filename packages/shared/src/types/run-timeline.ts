/**
 * Run timeline (Run Player) — Central de Execução.
 *
 * Aggregates a single heartbeat run into a structured, inspectable timeline:
 * run lifecycle + run events + audited activity + cost events + work products.
 * Served by `GET /companies/:companyId/runs/:runId/timeline`.
 */

export type RunTimelineEntryKind = "run_event" | "activity" | "cost" | "work_product";

export interface RunTimelineEntry {
  /** ISO timestamp of the event. */
  at: string;
  kind: RunTimelineEntryKind;
  /** Short human-readable label. */
  title: string;
  /** One-line detail (message, action, description). */
  summary?: string | null;
  /** Structured payload (provider extras, activity details, cost fields). */
  detail?: Record<string, unknown> | null;
  /** Run-event sequence number (only for kind = "run_event"). */
  seq?: number | null;
}

export interface RunTimelineTotals {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costCents: number;
  activityCount: number;
  workProductCount: number;
  runEventCount: number;
}

export interface RunTimelineRun {
  id: string;
  companyId: string;
  agentId: string;
  agentName: string;
  adapterType: string | null;
  status: string;
  invocationSource: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  error: string | null;
}

export interface RunTimelineResult {
  run: RunTimelineRun;
  entries: RunTimelineEntry[];
  totals: RunTimelineTotals;
}
