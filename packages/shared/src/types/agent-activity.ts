/**
 * Agent activity feed — acompanhamento de agentes (Paperclip ERP).
 *
 * Aggregates what each agent did today (runs, comments, completed tasks) plus
 * a recent interaction feed (runs, comments, issue creation/completion,
 * delegations, approval requests/resolutions) for observing agent↔agent
 * collaboration. Served by `GET /companies/:companyId/agents/activity-feed`.
 */

export interface AgentActivitySummary {
  agentId: string;
  agentName: string;
  status: string;
  runsToday: number;
  commentsToday: number;
  tasksCompletedToday: number;
  tasksAssignedToday: number;
  lastRunAt: string | null;
  lastActivityAt: string | null;
}

export type AgentActivityEventKind =
  | "run"
  | "comment"
  | "issue_created"
  | "issue_completed"
  | "delegation"
  | "approval_requested"
  | "approval_resolved";

export interface AgentActivityEvent {
  id: string;
  at: string;
  actorAgentId: string | null;
  actorAgentName: string | null;
  kind: AgentActivityEventKind;
  title: string;
  summary: string | null;
  issueId: string | null;
  issueIdentifier: string | null;
}

export interface AgentActivityFeed {
  agents: AgentActivitySummary[];
  events: AgentActivityEvent[];
  window: { from: string; to: string };
}
