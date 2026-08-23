/**
 * ERP master data service — Paperclip ERP.
 *
 * Company-scoped CRUD for customers, suppliers, products and the chart of
 * accounts. All mutations are board-gated at the route layer; codes/tax ids
 * are unique per company.
 */

import { and, asc, eq, ilike, or } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  erpChartOfAccounts,
  erpCustomers,
  erpProducts,
  erpSuppliers,
} from "@paperclipai/db";
import type {
  CreateErpAccount,
  CreateErpCustomer,
  CreateErpProduct,
  CreateErpSupplier,
  UpdateErpAccount,
  UpdateErpCustomer,
  UpdateErpProduct,
  UpdateErpSupplier,
} from "@paperclipai/shared";
import { notFound } from "../errors.js";

export interface MasterDataListOptions {
  q?: string;
  status?: string;
  limit: number;
  offset: number;
}

function searchCondition(q: string | undefined, columns: any[]) {
  if (!q) return undefined;
  const pattern = `%${q}%`;
  return or(...columns.map((col: any) => ilike(col, pattern)));
}

export function masterDataService(db: Db) {
  return {
    // --- Customers ---
    listCustomers: async (companyId: string, options: MasterDataListOptions) =>
      db
        .select()
        .from(erpCustomers)
        .where(
          and(
            eq(erpCustomers.companyId, companyId),
            options.status ? eq(erpCustomers.status, options.status) : undefined,
            searchCondition(options.q, [erpCustomers.name, erpCustomers.code, erpCustomers.taxId]),
          ),
        )
        .orderBy(asc(erpCustomers.code))
        .limit(options.limit)
        .offset(options.offset),

    getCustomer: async (companyId: string, id: string) => {
      const row = await db
        .select()
        .from(erpCustomers)
        .where(and(eq(erpCustomers.id, id), eq(erpCustomers.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Customer not found");
      return row;
    },

    createCustomer: async (companyId: string, input: CreateErpCustomer, userId: string | null) =>
      db
        .insert(erpCustomers)
        .values({ companyId, ...input, createdByUserId: userId })
        .returning()
        .then((rows) => rows[0]),

    updateCustomer: async (companyId: string, id: string, input: UpdateErpCustomer) => {
      const [row] = await db
        .update(erpCustomers)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(erpCustomers.id, id), eq(erpCustomers.companyId, companyId)))
        .returning();
      if (!row) throw notFound("Customer not found");
      return row;
    },

    // --- Suppliers ---
    listSuppliers: async (companyId: string, options: MasterDataListOptions) =>
      db
        .select()
        .from(erpSuppliers)
        .where(
          and(
            eq(erpSuppliers.companyId, companyId),
            options.status ? eq(erpSuppliers.status, options.status) : undefined,
            searchCondition(options.q, [erpSuppliers.name, erpSuppliers.code, erpSuppliers.taxId]),
          ),
        )
        .orderBy(asc(erpSuppliers.code))
        .limit(options.limit)
        .offset(options.offset),

    getSupplier: async (companyId: string, id: string) => {
      const row = await db
        .select()
        .from(erpSuppliers)
        .where(and(eq(erpSuppliers.id, id), eq(erpSuppliers.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Supplier not found");
      return row;
    },

    createSupplier: async (companyId: string, input: CreateErpSupplier, userId: string | null) =>
      db
        .insert(erpSuppliers)
        .values({ companyId, ...input, createdByUserId: userId })
        .returning()
        .then((rows) => rows[0]),

    updateSupplier: async (companyId: string, id: string, input: UpdateErpSupplier) => {
      const [row] = await db
        .update(erpSuppliers)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(erpSuppliers.id, id), eq(erpSuppliers.companyId, companyId)))
        .returning();
      if (!row) throw notFound("Supplier not found");
      return row;
    },

    // --- Products ---
    listProducts: async (companyId: string, options: MasterDataListOptions) =>
      db
        .select()
        .from(erpProducts)
        .where(
          and(
            eq(erpProducts.companyId, companyId),
            options.status ? eq(erpProducts.status, options.status) : undefined,
            searchCondition(options.q, [erpProducts.name, erpProducts.code, erpProducts.ncm]),
          ),
        )
        .orderBy(asc(erpProducts.code))
        .limit(options.limit)
        .offset(options.offset),

    getProduct: async (companyId: string, id: string) => {
      const row = await db
        .select()
        .from(erpProducts)
        .where(and(eq(erpProducts.id, id), eq(erpProducts.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Product not found");
      return row;
    },

    createProduct: async (companyId: string, input: CreateErpProduct, userId: string | null) =>
      db
        .insert(erpProducts)
        .values({ companyId, ...input, createdByUserId: userId })
        .returning()
        .then((rows) => rows[0]),

    updateProduct: async (companyId: string, id: string, input: UpdateErpProduct) => {
      const [row] = await db
        .update(erpProducts)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(erpProducts.id, id), eq(erpProducts.companyId, companyId)))
        .returning();
      if (!row) throw notFound("Product not found");
      return row;
    },

    // --- Chart of accounts ---
    listAccounts: async (companyId: string, options: MasterDataListOptions) =>
      db
        .select()
        .from(erpChartOfAccounts)
        .where(
          and(
            eq(erpChartOfAccounts.companyId, companyId),
            options.status ? eq(erpChartOfAccounts.status, options.status) : undefined,
            searchCondition(options.q, [erpChartOfAccounts.name, erpChartOfAccounts.code]),
          ),
        )
        .orderBy(asc(erpChartOfAccounts.code))
        .limit(options.limit)
        .offset(options.offset),

    getAccount: async (companyId: string, id: string) => {
      const row = await db
        .select()
        .from(erpChartOfAccounts)
        .where(and(eq(erpChartOfAccounts.id, id), eq(erpChartOfAccounts.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Account not found");
      return row;
    },

    createAccount: async (companyId: string, input: CreateErpAccount, userId: string | null) =>
      db
        .insert(erpChartOfAccounts)
        .values({ companyId, ...input, createdByUserId: userId })
        .returning()
        .then((rows) => rows[0]),

    updateAccount: async (companyId: string, id: string, input: UpdateErpAccount) => {
      const [row] = await db
        .update(erpChartOfAccounts)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(erpChartOfAccounts.id, id), eq(erpChartOfAccounts.companyId, companyId)))
        .returning();
      if (!row) throw notFound("Account not found");
      return row;
    },
  };
}
