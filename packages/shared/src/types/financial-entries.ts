import type { FinancialEntryStatus } from "../constants.js";

export interface ErpFinancialEntry {
  id: string;
  companyId: string;
  description: string;
  amountCents: number;
  currency: string;
  dueDate: string;
  status: FinancialEntryStatus;
  paidAt: string | null;
  paidAmountCents: number | null;
  paymentMethod: string | null;
  metadata: Record<string, unknown>;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ErpPayable extends ErpFinancialEntry {
  supplierId: string | null;
  fiscalDocumentId: string | null;
}

export interface ErpReceivable extends ErpFinancialEntry {
  customerId: string | null;
  fiscalDocumentId: string | null;
}
