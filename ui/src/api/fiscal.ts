import { api } from "./client";

export interface FiscalQueueDocument {
  id: string;
  model: string;
  operationDirection: "inbound" | "outbound";
  status: string;
  accessKey: string;
  number: number;
  series: number;
  emitterTaxId: string;
  receiverTaxId: string | null;
  totalsCents: number;
  providerKey: string | null;
  protocol: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalQueue {
  documents: FiscalQueueDocument[];
  counts: Record<string, number>;
}

export interface FiscalProviderBinding {
  id: string;
  providerKey: string;
  documentModels: string[];
  config: {
    environment?: string;
    baseUrl?: string;
    [key: string]: unknown;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const fiscalApi = {
  queue: (companyId: string, limit = 50) =>
    api.get<FiscalQueue>(`/companies/${companyId}/fiscal/queue?limit=${limit}`),

  listDocuments: (companyId: string, params?: { status?: string; model?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.model) qs.set("model", params.model);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return api.get<FiscalQueueDocument[]>(
      `/companies/${companyId}/fiscal/documents${query ? `?${query}` : ""}`,
    );
  },

  getDocument: (companyId: string, documentId: string) =>
    api.get(`/companies/${companyId}/fiscal/documents/${documentId}`),

  transmit: (companyId: string, documentId: string) =>
    api.post(`/companies/${companyId}/fiscal/documents/${documentId}/transmit`, {}),

  consult: (companyId: string, documentId: string) =>
    api.post(`/companies/${companyId}/fiscal/documents/${documentId}/consult`, {}),

  confirmInbound: (companyId: string, documentId: string) =>
    api.post(`/companies/${companyId}/fiscal/documents/${documentId}/confirm-inbound`, {}),

  manifest: (companyId: string, documentId: string, kind: string, justification?: string) =>
    api.post(`/companies/${companyId}/fiscal/documents/${documentId}/manifestation`, {
      kind,
      justification,
    }),

  persistFiles: (companyId: string, documentId: string) =>
    api.post(`/companies/${companyId}/fiscal/documents/${documentId}/persist-files`, {}),

  lookupInbound: (companyId: string, accessKey: string, model = "nfe") =>
    api.post(`/companies/${companyId}/fiscal/inbound/lookup`, { accessKey, model }),

  listBindings: (companyId: string) =>
    api.get<FiscalProviderBinding[]>(`/companies/${companyId}/fiscal/provider-bindings`),

  upsertBinding: (
    companyId: string,
    binding: {
      providerKey: string;
      documentModels?: string[];
      config: Record<string, unknown>;
      enabled?: boolean;
    },
  ) => api.put(`/companies/${companyId}/fiscal/provider-bindings`, binding),
};
