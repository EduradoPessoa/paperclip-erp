import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bot, Clock3, Eye, FileText, Layers, Radio, Wallet } from "lucide-react";
import { executionApi, type ExecutionLiveRun } from "../api/execution";
import { EmptyState } from "../components/EmptyState";
import { Identity } from "../components/Identity";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { useCompany } from "../context/CompanyContext";
import { formatCents, formatDateTime } from "../lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/lib/router";

function runDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function activeRunCount(runs: ExecutionLiveRun[]): number {
  return runs.filter((run) => run.status === "queued" || run.status === "running").length;
}

export function Execution() {
  const { selectedCompanyId } = useCompany();
  const companyId = selectedCompanyId ?? "";

  const runsQuery = useQuery({
    queryKey: ["execution", "live", companyId],
    queryFn: () => executionApi.liveRuns(companyId),
    enabled: Boolean(companyId),
    refetchInterval: 5000,
  });

  const dashboardQuery = useQuery({
    queryKey: ["execution", "dashboard", companyId],
    queryFn: () => executionApi.dashboard(companyId),
    enabled: Boolean(companyId),
    refetchInterval: 30000,
  });

  const reviewQuery = useQuery({
    queryKey: ["execution", "review", companyId],
    queryFn: () => executionApi.reviewCases(companyId),
    enabled: Boolean(companyId),
    refetchInterval: 10000,
  });

  const fiscalQuery = useQuery({
    queryKey: ["execution", "fiscal", companyId],
    queryFn: () => executionApi.fiscalQueue(companyId),
    enabled: Boolean(companyId),
    refetchInterval: 15000,
  });

  const runs = runsQuery.data ?? [];
  const activeRuns = useMemo(() => activeRunCount(runs), [runs]);
  const workingAgents = useMemo(
    () => new Set(runs.filter((r) => r.status === "running").map((r) => r.agentId)).size,
    [runs],
  );

  const pendingHuman =
    (reviewQuery.data?.length ?? 0) + (dashboardQuery.data?.pendingApprovals ?? 0);

  const fiscalPending = Object.entries(fiscalQuery.data?.counts ?? {})
    .filter(([status]) => ["draft", "transmitted", "rejected", "denied", "error"].includes(status))
    .reduce((sum, [, count]) => sum + count, 0);

  const costTodayCents = dashboardQuery.data?.costs.monthSpendCents ?? 0;

  if (runsQuery.isLoading && !runsQuery.data) return <PageSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-(length:--text-title) font-semibold text-foreground">Execução</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe ao vivo o que os agentes estão fazendo — e o que aguarda a sua decisão.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Radio className="h-3.5 w-3.5" /> Runs ativos
            </span>
            <span className="text-(length:--text-h2) font-semibold">{activeRuns}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bot className="h-3.5 w-3.5" /> Agentes trabalhando
            </span>
            <span className="text-(length:--text-h2) font-semibold">{workingAgents}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-4">
            <Link to="/fiscal" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Eye className="h-3.5 w-3.5" /> Aguardando humano
            </Link>
            <span className="text-(length:--text-h2) font-semibold">{pendingHuman + fiscalPending}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Custo no mês
            </span>
            <span className="text-(length:--text-h2) font-semibold">{formatCents(costTodayCents)}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> Execução ao vivo
          </CardTitle>
          <CardDescription>Runs ativos e recentes por agente (atualiza a cada 5s).</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <EmptyState
              icon={Clock3}
              title="Nenhuma execução no momento"
              message="Quando um agente for acionado, o run aparece aqui ao vivo."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/agents/${run.agentId}`} className="inline-flex min-w-0 hover:underline">
                      <Identity name={run.agentName} size="sm" />
                    </Link>
                    <StatusBadge status={run.status} label={run.status} />
                  </div>
                  {run.currentStatusMessage ? (
                    <p className="text-sm text-foreground">{run.currentStatusMessage}</p>
                  ) : run.lastAssistantSnippet ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{run.lastAssistantSnippet}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock3 className="h-3 w-3" />
                      {runDuration(run.startedAt, run.finishedAt)}
                    </span>
                    <span>{run.adapterType}</span>
                    {run.currentToolName ? <span className="font-mono">{run.currentToolName}</span> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Iniciado {formatDateTime(run.startedAt ?? run.createdAt)}
                  </div>
                  <Link
                    to={`/execution/runs/${run.id}`}
                    className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
                  >
                    Ver linha do tempo
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" /> Aguardando decisão humana
          </CardTitle>
          <CardDescription>Revisões de pipeline e aprovações que precisam de você.</CardDescription>
        </CardHeader>
        <CardContent>
          {(reviewQuery.data?.length ?? 0) === 0 && (dashboardQuery.data?.pendingApprovals ?? 0) === 0 ? (
            <EmptyState
              icon={Eye}
              title="Nada pendente"
              message="Não há revisões nem aprovações aguardando decisão."
            />
          ) : (
            <div className="flex flex-col divide-y divide-border/60">
              {(reviewQuery.data ?? []).map((row) => (
                <Link
                  key={row.case.id}
                  to={`/pipelines/${row.case.pipelineId}/items/${row.case.id}`}
                  className="flex flex-col gap-1 py-2.5 hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">{row.case.title}</span>
                    <StatusBadge status={row.stage.kind} label={row.stage.name} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {row.pipeline.name}
                    {row.pendingSuggestion
                      ? ` · sugestão: ${row.pendingSuggestion.toStageKey} — ${row.pendingSuggestion.rationale}`
                      : ""}
                  </span>
                </Link>
              ))}
              {fiscalPending > 0 ? (
                <Link to="/fiscal" className="flex items-center justify-between gap-2 py-2.5 hover:bg-muted/40">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FileText className="h-4 w-4" /> Documentos fiscais pendentes
                  </span>
                  <StatusBadge status="error" label={`${fiscalPending} na fila`} />
                </Link>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
