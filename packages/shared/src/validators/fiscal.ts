import { z } from "zod";
import {
  FISCAL_DOCUMENT_MODELS,
  FISCAL_ENVIRONMENTS,
  FISCAL_PROVIDER_KEYS,
  FISCAL_TAX_TYPES,
} from "../constants.js";

const taxIdSchema = z
  .string()
  .min(11)
  .max(14)
  .regex(/^\d+$/, "taxId must contain digits only");

export const fiscalTaxLineSchema = z.object({
  taxType: z.enum(FISCAL_TAX_TYPES),
  baseCents: z.number().int().nonnegative(),
  rateBps: z.number().int().nonnegative(),
  amountCents: z.number().int().nonnegative(),
  creditable: z.boolean().default(false),
});

export const fiscalDocumentItemSchema = z.object({
  ncm: z.string().max(12).optional().nullable(),
  cest: z.string().max(12).optional().nullable(),
  cfop: z.string().max(8).optional().nullable(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(10),
  unitPriceCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  taxes: z.array(fiscalTaxLineSchema).optional().default([]),
});

export const fiscalPartySchema = z.object({
  name: z.string().min(1).max(200),
  taxId: taxIdSchema,
  municipalTaxId: z.string().max(30).optional().nullable(),
  stateTaxId: z.string().max(30).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().length(2).optional().nullable(),
  zipCode: z.string().max(10).optional().nullable(),
});

export const fiscalSplitPaymentSchema = z.object({
  enabled: z.boolean(),
  withheldCents: z.number().int().nonnegative(),
  rateBps: z.number().int().nonnegative().optional().nullable(),
});

export const createFiscalDocumentSchema = z.object({
  model: z.enum(FISCAL_DOCUMENT_MODELS),
  operationDirection: z.enum(["inbound", "outbound"]),
  caseId: z.string().guid().optional().nullable(),
  issueId: z.string().guid().optional().nullable(),
  number: z.number().int().positive(),
  series: z.number().int().nonnegative().default(1),
  accessKey: z.string().regex(/^\d{44}$/, "accessKey must be a 44-digit chave de acesso"),
  emitter: fiscalPartySchema,
  receiver: fiscalPartySchema.optional().nullable(),
  items: z.array(fiscalDocumentItemSchema).min(1),
  totalsCents: z.number().int().nonnegative(),
  taxes: z.array(fiscalTaxLineSchema).optional().default([]),
  splitPayment: fiscalSplitPaymentSchema.optional().nullable(),
  providerExtras: z.record(z.string(), z.unknown()).optional(),
});

export type CreateFiscalDocument = z.infer<typeof createFiscalDocumentSchema>;

export const transmitFiscalDocumentSchema = z.object({});

export const cancelFiscalDocumentSchema = z.object({
  justification: z.string().min(5).max(1000),
});

export const fiscalProviderBindingSchema = z.object({
  providerKey: z.enum(FISCAL_PROVIDER_KEYS),
  documentModels: z.array(z.enum(FISCAL_DOCUMENT_MODELS)).min(1).optional(),
  config: z.object({
    baseUrl: z.string().url().optional(),
    apiKeySecretRef: z.string().min(1).optional(),
    certificateSecretRef: z.string().min(1).optional(),
    environment: z.enum(FISCAL_ENVIRONMENTS).default("homologation"),
    extra: z.record(z.string(), z.unknown()).optional(),
  }),
  enabled: z.boolean().optional().default(true),
});

export type UpsertFiscalProviderBinding = z.infer<typeof fiscalProviderBindingSchema>;
