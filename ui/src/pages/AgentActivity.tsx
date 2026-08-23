import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bot,
  CheckCircle2,
  GitBranch,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Stamp,
} from "lucide-react";
import { agentActivityApi, type AgentActivityFeed } from "../api/agent-activity";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { useCompany } from "../context/CompanyContext";
import { formatDateTime } from "../lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/lib/router";

const KIND_ICON: Record<string, typeof Bot> = {
  run: Activity,
  comment: MessageSquare,
  issue_created: PlusCircle,
  issue_completed: CheckCircle2,
  delegation: GitBranch,
  approval_requested: Stamp,
  approval_resolved: CheckCircle2,
};

const KIND_LABEL: Record<string, string> = {
  run: "Executou",
  comment: "Comentou",
  issue_created: "Criou tarefa",
  issue_completed: "Concluiu tarefa",
  delegation: "Delegou",
  approval_requested: "Pediu aprovação",
  approval_resolved: "Resolveu aprovação",
};

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h atrás`;
}

export function AgentActivity() {
  const { selectedCompanyId } = useCompany();
  const companyId = selectedCompanyId ?? "";

  const feedQuery = useQuery({
    queryKey: ["agents", "activity", companyId],
    queryFn: () => agentActivityApi.feed(companyId),
    enabled: Boolean(companyId),
    refetchInterval: 10000,
  });

  if (feedQuery.isLoading && !feedQuery.data) return <PageSkeleton />;

  const feed: AgentActivityFeed | undefined = feedQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-(length:--text-title) font-semibold text-foreground">Agentes</h1>
          <p className="text-sm text-muted-foreground">
            O que cada agente fez hoje e como eles interagem (atualiza a cada 10s).
          </p>
        </div>
        <button
          type="button"
          onClick={() => feedQuery.refetch()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4" /> Resumo do dia
          </CardTitle>
          <CardDescription>Indicadores por agente desde o início do dia (UTC).</CardDescription>
        </CardHeader>
        <CardContent>
          {(feed?.agents.length ?? 0) === 0 ? (
            <EmptyState
              icon={Bot}
              title="Nenhum agente"
              message="Crie agentes no org chart para acompanhá-los aqui."
              description="Vá em Org para contratar o primeiro agente."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(feed?.agents ?? []).map((agent) => (
                <div key={agent.agentId} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/agents/${agent.agentId}`} className="inline-flex min-w-0 hover:underline">
                      <span className="truncate text-sm font-medium text-foreground">{agent.agentName}</span>
                    </Link>
                    <StatusBadge status={agent.status} label={agent.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                    <span>Runs: <span className="font-semibold text-foreground">{agent.runsToday}</span></span>
                    <span>Comentários: <span className="font-semibold text-foreground">{agent.commentsToday}</span></span>
                    <span>Concluídas: <span className="font-semibold text-foreground">{agent.tasksCompletedToday}</span></span>
                    <span>Atribuídas: <span className="font-semibold text-foreground">{agent.tasksAssignedToday}</span></span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Última atividade: {agent.lastActivityAt ? relativeTime(agent.lastActivityAt) : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Interações recentes
          </CardTitle>
          <CardDescription>Comentários, execuções e movimentações entre agentes.</CardDescription>
        </CardHeader>
        <CardContent>
          {(feed?.events.length ?? 0) === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="Sem interações ainda"
              message="Quando os agentes executarem e comentarem, o feed aparece aqui."
            />
          ) : (
            <ol className="flex flex-col">
              {(feed?.events ?? []).map((event) => {
                const Icon = KIND_ICON[event.kind] ?? Activity;
                return (
                  <li key={event.id} className="flex gap-3 border-b border-border/60 py-2 last:border-b-0">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm text-foreground">
                          <span className="font-medium">{event.actorAgentName ?? "Sistema"}</span>{" "}
                          {KIND_LABEL[event.kind] ?? event.kind}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(event.at)}</span>
                      </div>
                      {event.issueId ? (
                        <Link to={`/issues/${event.issueId}`} className="text-xs text-muted-foreground hover:underline">
                          {event.summary ?? event.issueIdentifier ?? "tarefa"}
                        </Link>
                      ) : event.summary ? (
                        <p className="truncate text-xs text-muted-foreground">{event.summary}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
