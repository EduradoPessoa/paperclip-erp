/**
 * Agent activity service — acompanhamento de agentes (Paperclip ERP).
 *
 * Aggregates per-agent "today" indicators (runs, comments, completed and
 * assigned tasks, last activity) and a recent interaction feed built from
 * runs, issue comments, issue creation/completion, approvals and task
 * assignment events.
 */

import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  approvals,
  heartbeatRuns,
  issueComments,
  issues,
} from "@paperclipai/db";
import type {
  AgentActivityEvent,
  AgentActivityEventKind,
  AgentActivityFeed,
  AgentActivitySummary,
} from "@paperclipai/shared";

export interface AgentActivityOptions {
  limit: number;
}

export function startOfDayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function agentActivityService(db: Db) {
  return {
    feed: async (companyId: string, options: AgentActivityOptions): Promise<AgentActivityFeed> => {
      const from = startOfDayUtc();
      const to = new Date();

      const agentRows = await db
        .select({ id: agents.id, name: agents.name, status: agents.status })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .orderBy(asc(agents.name));

      const [runsToday, commentsToday, completedToday, assignedToday] = await Promise.all([
        db
          .select({ agentId: heartbeatRuns.agentId, count: sql<number>`count(*)::int` })
          .from(heartbeatRuns)
          .where(and(eq(heartbeatRuns.companyId, companyId), gte(heartbeatRuns.startedAt, from)))
          .groupBy(heartbeatRuns.agentId),
        db
          .select({ agentId: issueComments.authorAgentId, count: sql<number>`count(*)::int` })
          .from(issueComments)
          .where(
            and(
              eq(issueComments.companyId, companyId),
              sql`${issueComments.authorAgentId} is not null`,
              gte(issueComments.createdAt, from),
            ),
          )
          .groupBy(issueComments.authorAgentId),
        db
          .select({ agentId: issues.assigneeAgentId, count: sql<number>`count(*)::int` })
          .from(issues)
          .where(
            and(
              eq(issues.companyId, companyId),
              sql`${issues.assigneeAgentId} is not null`,
              sql`${issues.completedAt} is not null`,
              gte(issues.completedAt, from),
            ),
          )
          .groupBy(issues.assigneeAgentId),
        db
          .select({ agentId: issues.assigneeAgentId, count: sql<number>`count(*)::int` })
          .from(issues)
          .where(
            and(
              eq(issues.companyId, companyId),
              sql`${issues.assigneeAgentId} is not null`,
              gte(issues.createdAt, from),
            ),
          )
          .groupBy(issues.assigneeAgentId),
      ]);

      const countBy = (rows: Array<{ agentId: string | null; count: number }>) =>
        new Map(rows.map((row) => [row.agentId ?? "", row.count]));

      const runsMap = countBy(runsToday);
      const commentsMap = countBy(commentsToday);
      const completedMap = countBy(completedToday);
      const assignedMap = countBy(assignedToday);

      const lastRunRows = await db
        .select({
          agentId: heartbeatRuns.agentId,
          lastRunAt: sql<string>`max(${heartbeatRuns.startedAt})::text`,
        })
        .from(heartbeatRuns)
        .where(eq(heartbeatRuns.companyId, companyId))
        .groupBy(heartbeatRuns.agentId);

      const lastRunMap = new Map(lastRunRows.map((row) => [row.agentId, row.lastRunAt]));

      const agentsSummary: AgentActivitySummary[] = agentRows.map((agent) => {
        const lastRunAt = lastRunMap.get(agent.id) ?? null;
        const lastActivityAt = lastRunAt; // extended with comments below
        return {
          agentId: agent.id,
          agentName: agent.name,
          status: agent.status,
          runsToday: runsMap.get(agent.id) ?? 0,
          commentsToday: commentsMap.get(agent.id) ?? 0,
          tasksCompletedToday: completedMap.get(agent.id) ?? 0,
          tasksAssignedToday: assignedMap.get(agent.id) ?? 0,
          lastRunAt,
          lastActivityAt,
        };
      });

      // --- Interaction events ---
      const eventRows = await db
        .select({
          id: issueComments.id,
          at: issueComments.createdAt,
          agentId: issueComments.authorAgentId,
          agentName: agents.name,
          issueId: issues.id,
          issueIdentifier: issues.identifier,
          issueTitle: issues.title,
        })
        .from(issueComments)
        .innerJoin(agents, eq(issueComments.authorAgentId, agents.id))
        .innerJoin(issues, eq(issueComments.issueId, issues.id))
        .where(and(eq(issueComments.companyId, companyId), sql`${issueComments.authorAgentId} is not null`))
        .orderBy(desc(issueComments.createdAt))
        .limit(options.limit);

      const events: AgentActivityEvent[] = eventRows.map((row) => ({
        id: `comment-${row.id}`,
        at: row.at.toISOString(),
        actorAgentId: row.agentId,
        actorAgentName: row.agentName,
        kind: "comment" as AgentActivityEventKind,
        title: "Comentou em tarefa",
        summary: row.issueTitle,
        issueId: row.issueId,
        issueIdentifier: row.issueIdentifier,
      }));

      const runEventRows = await db
        .select({
          id: heartbeatRuns.id,
          at: heartbeatRuns.startedAt,
          agentId: heartbeatRuns.agentId,
          agentName: agents.name,
          status: heartbeatRuns.status,
        })
        .from(heartbeatRuns)
        .innerJoin(agents, eq(heartbeatRuns.agentId, agents.id))
        .where(eq(heartbeatRuns.companyId, companyId))
        .orderBy(desc(heartbeatRuns.startedAt))
        .limit(options.limit);

      for (const row of runEventRows) {
        if (!row.at) continue;
        events.push({
          id: `run-${row.id}`,
          at: row.at.toISOString(),
          actorAgentId: row.agentId,
          actorAgentName: row.agentName,
          kind: "run",
          title: "Executou (run)",
          summary: `status ${row.status}`,
          issueId: null,
          issueIdentifier: null,
        });
      }

      events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

      return {
        agents: agentsSummary,
        events: events.slice(0, options.limit),
        window: { from: from.toISOString(), to: to.toISOString() },
      };
    },
  };
}
