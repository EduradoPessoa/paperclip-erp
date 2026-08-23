import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowLeft, Bot, Clock3, FileText, Wallet } from "lucide-react";
import { executionApi } from "../api/execution";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { useCompany } from "../context/CompanyContext";
import { formatCents, formatDateTime } from "../lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useParams } from "@/lib/router";

const KIND_ICONS: Record<string, string> = {
  run_event: "•",
  activity: "▸",
  cost: "$",
  work_product: "◆",
};

export function RunPlayer() {
  const { selectedCompanyId } = useCompany();
  const params = useParams<{ runId?: string }>();
  const companyId = selectedCompanyId ?? "";
  const runId = params.runId ?? "";

  const timelineQuery = useQuery({
    queryKey: ["execution", "run-timeline", companyId, runId],
    queryFn: () => executionApi.runTimeline(companyId, runId),
    enabled: Boolean(companyId && runId),
    refetchInterval: 5000,
  });

  const timeline = timelineQuery.data;

  const groupedEntries = useMemo(() => {
    if (!timeline) return [];
    // Run events carry a seq; keep provider order, then activity/cost/products by time.
    const withIndex = timeline.entries.map((entry, index) => ({ entry, index }));
    return withIndex.sort((a, b) => {
      const aAt = new Date(a.entry.at).getTime();
      const bAt = new Date(b.entry.at).getTime();
      if (aAt !== bAt) return aAt - bAt;
      return (a.entry.seq ?? a.index) - (b.entry.seq ?? b.index);
    });
  }, [timeline]);

  if (timelineQuery.isLoading && !timeline) return <PageSkeleton />;

  if (!timeline) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/execution" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Execução
        </Link>
        <p className="text-sm text-muted-foreground">Run não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link to="/execution" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Execução
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-(length:--text-title) font-semibold text-foreground">Run</h1>
          <StatusBadge status={timeline.run.status} label={timeline.run.status} />
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" />
            <Link to={`/agents/${timeline.run.agentId}`} className="hover:underline">
              {timeline.run.agentName}
            </Link>
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {timeline.run.adapterType} · {timeline.run.invocationSource} · iniciado{" "}
          {formatDateTime(timeline.run.startedAt ?? timeline.run.createdAt)}
          {timeline.run.finishedAt ? ` · finalizado ${formatDateTime(timeline.run.finishedAt)}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> Eventos
            </span>
            <span className="text-(length:--text-h2) font-semibold">{timeline.totals.runEventCount}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Work products
            </span>
            <span className="text-(length:--text-h2) font-semibold">{timeline.totals.workProductCount}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" /> Ações auditadas
            </span>
            <span className="text-(length:--text-h2) font-semibold">{timeline.totals.activityCount}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Custo
            </span>
            <span className="text-(length:--text-h2) font-semibold">{formatCents(timeline.totals.costCents)}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Linha do tempo</CardTitle>
          <CardDescription>
            {timeline.totals.inputTokens + timeline.totals.cachedInputTokens + timeline.totals.outputTokens} tokens ·{" "}
            {formatCents(timeline.totals.costCents)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groupedEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado para este run.</p>
          ) : (
            <ol className="relative flex flex-col">
              {groupedEntries.map(({ entry, index }) => (
                <li key={`${index}-${entry.at}`} className="flex gap-3 py-1.5">
                  <span className="mt-0.5 w-4 shrink-0 text-center text-xs text-muted-foreground">
                    {KIND_ICONS[entry.kind] ?? "•"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-xs text-foreground">{entry.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDateTime(entry.at)}
                      </span>
                    </div>
                    {entry.summary ? (
                      <p className="truncate text-sm text-muted-foreground">{entry.summary}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
