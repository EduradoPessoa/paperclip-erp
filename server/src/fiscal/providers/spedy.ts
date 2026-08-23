/**
 * SPEDY fiscal provider — first integrator for the Paperclip ERP fiscal
 * module.
 *
 * SPEDY exposes a REST API at `api.spedy.br` (public OpenAPI spec) for
 * emitting and managing Brazilian electronic tax documents. This adapter maps
 * the stable `FiscalProvider` contract to that API.
 *
 * F1 status: the exact endpoint paths/fields must be validated against the
 * SPEDY OpenAPI in SEFAZ homologation. Endpoints below follow the documented
 * contract shape; provider responses are preserved in `providerRaw` so the
 * mapping can be tightened without core changes. Credentials are expected via
 * resolved config (F1: `extra.apiKey`; F2: `company_secrets` refs).
 */

import type {
  FiscalCancelRequest,
  FiscalCancelResult,
  FiscalConsultRequest,
  FiscalDownloadRequest,
  FiscalDownloadResult,
  FiscalEmitRequest,
  FiscalEmitResult,
  FiscalFetchRequest,
  FiscalFetchResult,
  FiscalInvalidateRequest,
  FiscalInvalidateResult,
  FiscalListEventsRequest,
  FiscalManifestRequest,
  FiscalManifestResult,
  FiscalProvider,
  FiscalProviderEvent,
  FiscalStatusResult,
} from "@paperclipai/shared";
import { badRequest } from "../../errors.js";
import { logger } from "../../middleware/logger.js";
import type { ResolvedFiscalProviderConfig } from "../provider.js";

const DEFAULT_BASE_URL = "https://api.spedy.br";

interface SpedyHttpOptions {
  method: string;
  path: string;
  apiKey: string;
  baseUrl: string;
  body?: Record<string, unknown>;
}

async function spedyRequest<T>(options: SpedyHttpOptions): Promise<{ data: T; status: number }> {
  const url = `${options.baseUrl.replace(/\/$/, "")}${options.path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    logger.warn({ provider: "spedy", url, error }, "spedy request failed at transport level");
    throw badRequest(`SPEDY request failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const raw = await response.text();
  let json: unknown = null;
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      json = { rawBody: raw.slice(0, 2000) };
    }
  }

  if (!response.ok) {
    throw badRequest(`SPEDY responded ${response.status}: ${JSON.stringify(json).slice(0, 2000)}`);
  }
  return { data: json as T, status: response.status };
}

export function createSpedyProvider(config: ResolvedFiscalProviderConfig): FiscalProvider {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const apiKey = config.apiKey ?? "";

  return {
    key: "spedy",
    capabilities: {
      documentModels: ["nfe", "nfce", "nfse", "cte", "mdfe"],
      danfe: true,
      webhooks: true,
      splitPayment: true,
      manifestation: true,
      fetchByAccessKey: true,
    },

    async emit(req: FiscalEmitRequest): Promise<FiscalEmitResult> {
      if (!apiKey) {
        throw badRequest("SPEDY provider is not configured with an API key (binding config)");
      }
      // F1 mapping: one document endpoint per model is expected (e.g.
      // /v1/nfe, /v1/nfse, /v1/cte). Validate against the SPEDY OpenAPI.
      const { data } = await spedyRequest<{
        id?: string;
        status?: string;
        protocol?: string | null;
        message?: string | null;
        xml?: string | null;
      }>({
        method: "POST",
        path: `/v1/${req.model}`,
        apiKey,
        baseUrl,
        body: {
          accessKey: req.accessKey,
          number: req.number,
          series: req.series,
          operation: req.operationDirection,
          emitter: req.emitter,
          receiver: req.receiver ?? undefined,
          items: req.items,
          totalsCents: req.totalsCents,
          taxes: req.taxes,
          splitPayment: req.splitPayment ?? undefined,
          ...req.providerExtras,
        },
      });

      const normalizedStatus: FiscalEmitResult["status"] =
        data.status === "authorized" ? "authorized"
        : data.status === "rejected" ? "rejected"
        : data.status === "denied" ? "denied"
        : "transmitted";

      return {
        providerDocumentId: data.id ?? req.accessKey,
        status: normalizedStatus,
        message: data.message ?? null,
        protocol: data.protocol ?? null,
        signedXml: data.xml ?? null,
        providerRaw: data as unknown as Record<string, unknown>,
      };
    },

    async cancel(req: FiscalCancelRequest): Promise<FiscalCancelResult> {
      if (!apiKey) {
        throw badRequest("SPEDY provider is not configured with an API key (binding config)");
      }
      const { data } = await spedyRequest<{
        status?: string;
        protocol?: string | null;
        message?: string | null;
      }>({
        method: "POST",
        path: `/v1/${req.accessKey}/cancel`,
        apiKey,
        baseUrl,
        body: { justification: req.justification },
      });
      return {
        status: data.status === "cancelled" ? "cancelled" : "error",
        protocol: data.protocol ?? null,
        message: data.message ?? null,
        providerRaw: data as unknown as Record<string, unknown>,
      };
    },

    async invalidate(req: FiscalInvalidateRequest): Promise<FiscalInvalidateResult> {
      if (!apiKey) {
        throw badRequest("SPEDY provider is not configured with an API key (binding config)");
      }
      const { data } = await spedyRequest<{
        status?: string;
        protocol?: string | null;
        message?: string | null;
      }>({
        method: "POST",
        path: `/v1/${req.model}/invalidate`,
        apiKey,
        baseUrl,
        body: { number: req.number, series: req.series, justification: req.justification },
      });
      return {
        status: data.status === "invalidated" ? "invalidated" : "error",
        protocol: data.protocol ?? null,
        message: data.message ?? null,
        providerRaw: data as unknown as Record<string, unknown>,
      };
    },

    async consult(req: FiscalConsultRequest): Promise<FiscalStatusResult> {
      if (!apiKey) {
        throw badRequest("SPEDY provider is not configured with an API key (binding config)");
      }
      const { data } = await spedyRequest<{
        status?: string;
        protocol?: string | null;
        message?: string | null;
        xml?: string | null;
      }>({
        method: "GET",
        path: `/v1/${req.accessKey}`,
        apiKey,
        baseUrl,
      });

      const status = data.status as FiscalStatusResult["status"];
      return {
        status: status ?? "transmitted",
        protocol: data.protocol ?? null,
        message: data.message ?? null,
        signedXml: data.xml ?? null,
        providerRaw: data as unknown as Record<string, unknown>,
      };
    },

    async fetchByAccessKey(req: FiscalFetchRequest): Promise<FiscalFetchResult> {
      if (!apiKey) {
        throw badRequest("SPEDY provider is not configured with an API key (binding config)");
      }
      const { data } = await spedyRequest<{
        id?: string;
        status?: string;
        protocol?: string | null;
        message?: string | null;
        xml?: string | null;
      }>({
        method: "GET",
        path: `/v1/${req.accessKey}`,
        apiKey,
        baseUrl,
      });
      return {
        providerDocumentId: data.id ?? null,
        status: data.status ?? "transmitted",
        protocol: data.protocol ?? null,
        message: data.message ?? null,
        signedXml: data.xml ?? null,
        providerRaw: data as unknown as Record<string, unknown>,
      };
    },

    async manifest(req: FiscalManifestRequest): Promise<FiscalManifestResult> {
      if (!apiKey) {
        throw badRequest("SPEDY provider is not configured with an API key (binding config)");
      }
      const { data } = await spedyRequest<{
        status?: string;
        message?: string | null;
      }>({
        method: "POST",
        path: `/v1/${req.accessKey}/manifestation`,
        apiKey,
        baseUrl,
        body: { kind: req.kind, justification: req.justification ?? undefined },
      });
      return {
        status: data.status === "ok" ? "ok" : "error",
        message: data.message ?? null,
        providerRaw: data as unknown as Record<string, unknown>,
      };
    },

    async downloadXml(req: FiscalDownloadRequest): Promise<FiscalDownloadResult> {
      if (!apiKey) {
        throw badRequest("SPEDY provider is not configured with an API key (binding config)");
      }
      const response = await fetch(
        `${baseUrl.replace(/\/$/, "")}/v1/${req.accessKey}/xml`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (!response.ok) {
        throw badRequest(`SPEDY XML download responded ${response.status}`);
      }
      const content = new Uint8Array(await response.arrayBuffer());
      return {
        content,
        contentType: response.headers.get("content-type") ?? "application/xml",
        filename: `${req.accessKey}-nfe.xml`,
      };
    },

    async downloadDanfe(req: FiscalDownloadRequest): Promise<FiscalDownloadResult> {
      if (!apiKey) {
        throw badRequest("SPEDY provider is not configured with an API key (binding config)");
      }
      const response = await fetch(
        `${baseUrl.replace(/\/$/, "")}/v1/${req.accessKey}/danfe`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (!response.ok) {
        throw badRequest(`SPEDY DANFE download responded ${response.status}`);
      }
      const content = new Uint8Array(await response.arrayBuffer());
      return {
        content,
        contentType: response.headers.get("content-type") ?? "application/pdf",
        filename: `${req.accessKey}-danfe.pdf`,
      };
    },

    async listEvents(req: FiscalListEventsRequest): Promise<FiscalProviderEvent[]> {
      if (!apiKey) {
        throw badRequest("SPEDY provider is not configured with an API key (binding config)");
      }
      const { data } = await spedyRequest<{ events?: FiscalProviderEvent[] }>({
        method: "GET",
        path: `/v1/${req.accessKey}/events`,
        apiKey,
        baseUrl,
      });
      return data.events ?? [];
    },
  };
}
