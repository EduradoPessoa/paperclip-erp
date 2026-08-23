import { z } from "zod";
import { FINANCIAL_ENTRY_STATUSES } from "../constants.js";

const entryBase = {
  description: z.string().min(1).max(500),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).optional().default("BRL"),
  dueDate: z.string().datetime(),
  paymentMethod: z.string().max(60).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
};

export const createErpPayableSchema = z.object({
  supplierId: z.string().guid().optional().nullable(),
  fiscalDocumentId: z.string().guid().optional().nullable(),
  ...entryBase,
});
export type CreateErpPayable = z.infer<typeof createErpPayableSchema>;

export const createErpReceivableSchema = z.object({
  customerId: z.string().guid().optional().nullable(),
  fiscalDocumentId: z.string().guid().optional().nullable(),
  ...entryBase,
});
export type CreateErpReceivable = z.infer<typeof createErpReceivableSchema>;

export const updateErpPayableSchema = createErpPayableSchema.partial();
export type UpdateErpPayable = z.infer<typeof updateErpPayableSchema>;

export const updateErpReceivableSchema = createErpReceivableSchema.partial();
export type UpdateErpReceivable = z.infer<typeof updateErpReceivableSchema>;

export const settleFinancialEntrySchema = z.object({
  paidAmountCents: z.number().int().positive(),
  paymentMethod: z.string().max(60).optional().nullable(),
});
export type SettleFinancialEntry = z.infer<typeof settleFinancialEntrySchema>;

export const financialEntryStatusSchema = z.enum(FINANCIAL_ENTRY_STATUSES);
