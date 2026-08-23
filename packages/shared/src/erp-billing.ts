/**
 * Faturamento (billing) module — Paperclip ERP.
 *
 * Orchestrates outbound fiscal document emission (NF-e/NFS-e) from an
 * approved sales order: builds the fiscal draft from the order + customer +
 * emitter, transmits through the fiscal provider (FiscalProvider contract),
 * and on authorization links the receivable and moves the order to
 * `invoiced`.
 */

import { z } from "zod";
import { FISCAL_DOCUMENT_MODELS } from "./constants.js";
import { fiscalPartySchema, fiscalTaxLineSchema } from "./validators/fiscal.js";

/** Model codes used for placeholder access keys (NF-e=55, NFC-e=65, NFS-e=FS). */
const MODEL_CODES: Record<string, string> = {
  nfe: "55",
  nfce: "65",
  nfse: "FS",
  cte: "57",
  mdfe: "58",
  dfe: "DF",
};

/**
 * F1 placeholder chave de acesso (44 digits) until the provider assigns the
 * real key. Fully deterministic from taxId/number/series/model so tests and
 * homologation stay stable; real keys arrive with provider integration.
 */
export function buildPlaceholderAccessKey(input: {
  emitterTaxId: string;
  model: string;
  number: number;
  series: number;
}): string {
  const modelCode = MODEL_CODES[input.model] ?? "99";
  const digits =
    input.emitterTaxId.replace(/\D/g, "").padStart(14, "0") +
    modelCode +
    String(input.series).padStart(3, "0") +
    String(input.number).padStart(9, "0");
  return digits.padEnd(43, "0") + "0";
}

export const createBillingInvoiceSchema = z.object({
  salesOrderCaseId: z.string().guid(),
  model: z.enum(FISCAL_DOCUMENT_MODELS).default("nfe"),
  series: z.number().int().nonnegative().optional().default(1),
  number: z.number().int().positive().optional(),
  emitter: fiscalPartySchema,
  taxes: z.array(fiscalTaxLineSchema).optional().default([]),
});
export type CreateBillingInvoice = z.infer<typeof createBillingInvoiceSchema>;
