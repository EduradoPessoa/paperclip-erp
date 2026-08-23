import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, PackageCheck, RefreshCw, Send, Download } from "lucide-react";
import { fiscalApi, type FiscalQueueDocument } from "../api/fiscal";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { useCompany } from "../context/CompanyContext";
import { cn, formatCents, formatDateTime } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  validated: "Validado",
  transmitted: "Transmitido",
  authorized: "Autorizado",
  rejected: "Rejeitado",
  denied: "Denegado",
  cancelled: "Cancelado",
  invalidated: "Inutilizado",
  error: "Erro",
};

function documentStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/[_-]/g, " ");
}

function canTransmit(doc: FiscalQueueDocument): boolean {
  return doc.operationDirection === "outbound" && ["draft", "validated", "error"].includes(doc.status);
}

function canConfirmInbound(doc: FiscalQueueDocument): boolean {
  return doc.operationDirection === "inbound" && ["draft", "validated", "authorized"].includes(doc.status);
}

function canConsult(doc: FiscalQueueDocument): boolean {
  return Boolean(doc.providerKey) && !["cancelled", "invalidated"].includes(doc.status);
}

export function Fiscal() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const companyId = selectedCompanyId ?? "";

  const queueQuery = useQuery({
    queryKey: ["fiscal", "queue", companyId],
    queryFn: () => fiscalApi.queue(companyId),
    enabled: Boolean(companyId),
  });

  const invalidateQueue = () => {
    queryClient.invalidateQueries({ queryKey: ["fiscal", "queue", companyId] });
  };

  const transmitMutation = useMutation({
    mutationFn: (documentId: string) => fiscalApi.transmit(companyId, documentId),
    onSuccess: invalidateQueue,
  });

  const consultMutation = useMutation({
    mutationFn: (documentId: string) => fiscalApi.consult(companyId, documentId),
    onSuccess: invalidateQueue,
  });

  const confirmInboundMutation = useMutation({
    mutationFn: (documentId: string) => fiscalApi.confirmInbound(companyId, documentId),
    onSuccess: invalidateQueue,
  });

  const persistMutation = useMutation({
    mutationFn: (documentId: string) => fiscalApi.persistFiles(companyId, documentId),
    onSuccess: invalidateQueue,
  });

  const counts = useMemo(() => {
    const entries = Object.entries(queueQuery.data?.counts ?? {});
    return entries.sort(([a], [b]) => a.localeCompare(b));
  }, [queueQuery.data]);

  const documents = queueQuery.data?.documents ?? [];

  if (queueQuery.isLoading) return <PageSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-(length:--text-title) font-semibold text-foreground">Fiscal</h1>
        <p className="text-sm text-muted-foreground">
          Documentos fiscais eletrônicos — fila de transmissão, autorização e recebimento (entrada).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fila fiscal</CardTitle>
          <CardDescription>
            Contadores por status e documentos pendentes de ação.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {counts.length === 0 ? (
              <span className="text-sm text-muted-foreground">Sem documentos nesta empresa.</span>
            ) : (
              counts.map(([status, count]) => (
                <span
                  key={status}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap bg-muted text-muted-foreground",
                  )}
                >
                  <StatusBadge status={status} label={`${documentStatusLabel(status)} · ${count}`} />
                </span>
              ))
            )}
          </div>

          {documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhum documento pendente"
              message="A fila fiscal está vazia para esta empresa."
              description="Crie um documento (rascunho) ou aguarde callbacks do integrador."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Documento</th>
                    <th className="py-2 pr-3 font-medium">Modelo</th>
                    <th className="py-2 pr-3 font-medium">Direção</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Emitente</th>
                    <th className="py-2 pr-3 font-medium">Total</th>
                    <th className="py-2 pr-3 font-medium">Atualizado</th>
                    <th className="py-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-mono text-xs">{doc.accessKey}</td>
                      <td className="py-2 pr-3 uppercase">{doc.model}</td>
                      <td className="py-2 pr-3">{doc.operationDirection}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge status={doc.status} label={documentStatusLabel(doc.status)} />
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{doc.emitterTaxId}</td>
                      <td className="py-2 pr-3">{formatCents(doc.totalsCents)}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{formatDateTime(doc.updatedAt)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {canTransmit(doc) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => transmitMutation.mutate(doc.id)}
                              disabled={transmitMutation.isPending}
                            >
                              <Send className="h-3.5 w-3.5" />
                              Transmitir
                            </Button>
                          ) : null}
                          {canConfirmInbound(doc) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => confirmInboundMutation.mutate(doc.id)}
                              disabled={confirmInboundMutation.isPending}
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                              Confirmar entrada
                            </Button>
                          ) : null}
                          {canConsult(doc) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => consultMutation.mutate(doc.id)}
                              disabled={consultMutation.isPending}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Consultar
                            </Button>
                          ) : null}
                          {canConsult(doc) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => persistMutation.mutate(doc.id)}
                              disabled={persistMutation.isPending}
                            >
                              <Download className="h-3.5 w-3.5" />
                              Persistir XML/DANFE
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
