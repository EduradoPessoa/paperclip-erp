import type {
  AccountType,
  MasterEntityStatus,
  ProductStatus,
} from "../constants.js";

export interface ErpCustomer {
  id: string;
  companyId: string;
  code: string;
  name: string;
  taxId: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: MasterEntityStatus;
  metadata: Record<string, unknown>;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ErpSupplier {
  id: string;
  companyId: string;
  code: string;
  name: string;
  taxId: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: MasterEntityStatus;
  metadata: Record<string, unknown>;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ErpProduct {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string | null;
  ncm: string | null;
  cest: string | null;
  unit: string;
  priceCents: number | null;
  costCents: number | null;
  status: ProductStatus;
  metadata: Record<string, unknown>;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ErpChartAccount {
  id: string;
  companyId: string;
  code: string;
  name: string;
  accountType: AccountType;
  parentId: string | null;
  status: MasterEntityStatus;
  metadata: Record<string, unknown>;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
