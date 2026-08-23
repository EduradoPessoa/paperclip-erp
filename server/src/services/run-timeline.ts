/**
 * Run timeline service — Central de Execução (Run Player).
 *
 * Builds a structured, inspectable timeline for a single heartbeat run by
 * aggregating: the run row (with agent), `heartbeat_run_events`, audited
 * `activity_log` rows bound to the run, `cost_events` bound to the run, and
 * `issue_work_products` created by the run. Company-scoped: the run must
 * belong to the caller's company.
 */

import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  activityLog,
  agents,
  costEvents,
  heartbeatRunEvents,
  heartbeatRuns,
  issueWorkProducts,
} from "@paperclipai/db";
import type {
  RunTimelineEntry,
  RunTimelineResult,
  RunTimelineRun,
  RunTimelineTotals,
} from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";

export function mapRunEventToEntry(input: {
  at: Date;
  seq: number;
  eventType: string;
  level: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
}): RunTimelineEntry {
  return {
    at: input.at.toISOString(),
    kind: "run_event",
    seq: input.seq,
    title: input.eventType,
    summary: input.message ?? null,
    detail: input.payload ?? null,
  };
}

export function mapActivityToEntry(input: {
  at: Date;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown> | null;
}): RunTimelineEntry {
  return {
    at: input.at.toISOString(),
    kind: "activity",
    title: input.action,
    summary: `${input.entityType}:${input.entityId}`,
    detail: input.details ?? null,
  };
}

export function mapCostToEntry(input: {
  at: Date;
  provider: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costCents: number;
}): RunTimelineEntry {
  const totalTokens = input.inputTokens + input.cachedInputTokens + input.outputTokens;
  return {
    at: input.at.toISOString(),
    kind: "cost",
    title: `Custo — ${input.provider}/${input.model}`,
    summary: `${totalTokens} tokens · ${(input.costCents / 100).toFixed(2)}`,
    detail: {
      provider: input.provider,
      model: input.model,
      inputTokens: input.inputTokens,
      cachedInputTokens: input.cachedInputTokens,
      outputTokens: input.outputTokens,
      costCents: input.costCents,
    },
  };
}

export function mapWorkProductToEntry(input: {
  at: Date;
  title: string;
  issueId: string;
}): RunTimelineEntry {
  return {
    at: input.at.toISOString(),
    kind: "work_product",
    title: input.title || "Work product",
    summary: `issue:${input.issueId}`,
  };
}

export function runTimelineService(db: Db) {
  return {
    timeline: async (companyId: string, runId: string): Promise<RunTimelineResult> => {
      const runRow = await db
        .select({
          run: heartbeatRuns,
          agentName: agents.name,
          adapterType: agents.adapterType,
        })
        .from(heartbeatRuns)
        .innerJoin(agents, eq(heartbeatRuns.agentId, agents.id))
        .where(eq(heartbeatRuns.id, runId))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!runRow) throw notFound("Heartbeat run not found");
      if (runRow.run.companyId !== companyId) {
        throw unprocessable("Heartbeat run does not belong to company");
      }

      const [runEvents, activity, costs, workProducts] = await Promise.all([
        db
          .select()
          .from(heartbeatRunEvents)
          .where(and(eq(heartbeatRunEvents.companyId, companyId), eq(heartbeatRunEvents.runId, runId)))
          .orderBy(asc(heartbeatRunEvents.seq)),
        db
          .select()
          .from(activityLog)
          .where(and(eq(activityLog.companyId, companyId), eq(activityLog.runId, runId)))
          .orderBy(asc(activityLog.createdAt)),
        db
          .select()
          .from(costEvents)
          .where(and(eq(costEvents.companyId, companyId), eq(costEvents.heartbeatRunId, runId)))
          .orderBy(asc(costEvents.occurredAt)),
        db
          .select()
          .from(issueWorkProducts)
          .where(and(eq(issueWorkProducts.companyId, companyId), eq(issueWorkProducts.createdByRunId, runId)))
          .orderBy(asc(issueWorkProducts.createdAt)),
      ]);

      const entries: RunTimelineEntry[] = [
        ...runEvents.map((event) =>
          mapRunEventToEntry({
            at: event.createdAt,
            seq: event.seq,
            eventType: event.eventType,
            level: event.level,
            message: event.message,
            payload: event.payload,
          }),
        ),
        ...activity.map((row) =>
          mapActivityToEntry({
            at: row.createdAt,
            action: row.action,
            entityType: row.entityType,
            entityId: row.entityId,
            details: row.details,
          }),
        ),
        ...costs.map((cost) =>
          mapCostToEntry({
            at: cost.occurredAt,
            provider: cost.provider,
            model: cost.model,
            inputTokens: cost.inputTokens,
            cachedInputTokens: cost.cachedInputTokens,
            outputTokens: cost.outputTokens,
            costCents: cost.costCents,
          }),
        ),
        ...workProducts.map((wp) =>
          mapWorkProductToEntry({
            at: wp.createdAt,
            title: wp.title ?? "",
            issueId: wp.issueId,
          }),
        ),
      ];

      const totals: RunTimelineTotals = {
        inputTokens: costs.reduce((sum, c) => sum + c.inputTokens, 0),
        cachedInputTokens: costs.reduce((sum, c) => sum + c.cachedInputTokens, 0),
        outputTokens: costs.reduce((sum, c) => sum + c.outputTokens, 0),
        costCents: costs.reduce((sum, c) => sum + c.costCents, 0),
        activityCount: activity.length,
        workProductCount: workProducts.length,
        runEventCount: runEvents.length,
      };

      const run: RunTimelineRun = {
        id: runRow.run.id,
        companyId: runRow.run.companyId,
        agentId: runRow.run.agentId,
        agentName: runRow.agentName,
        adapterType: runRow.adapterType,
        status: runRow.run.status,
        invocationSource: runRow.run.invocationSource,
        startedAt: runRow.run.startedAt?.toISOString() ?? null,
        finishedAt: runRow.run.finishedAt?.toISOString() ?? null,
        createdAt: runRow.run.createdAt.toISOString(),
        error: runRow.run.error,
      };

      return { run, entries, totals };
    },
  };
}
