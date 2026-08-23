import { z } from "zod";
import { ACCOUNT_TYPES, MASTER_ENTITY_STATUSES, PRODUCT_STATUSES } from "../constants.js";

const codeSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "code must start with a letter or digit (letters, digits, . _ -)");

const taxIdSchema = z
  .string()
  .min(11)
  .max(14)
  .regex(/^\d+$/, "taxId must contain digits only");

const partyFields = {
  name: z.string().min(1).max(200),
  taxId: taxIdSchema,
  email: z.string().email().max(200).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().length(2).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
};

export const createErpCustomerSchema = z.object({
  code: codeSchema,
  ...partyFields,
  status: z.enum(MASTER_ENTITY_STATUSES).optional().default("active"),
});
export type CreateErpCustomer = z.infer<typeof createErpCustomerSchema>;

export const updateErpCustomerSchema = createErpCustomerSchema.partial();
export type UpdateErpCustomer = z.infer<typeof updateErpCustomerSchema>;

export const createErpSupplierSchema = z.object({
  code: codeSchema,
  ...partyFields,
  status: z.enum(MASTER_ENTITY_STATUSES).optional().default("active"),
});
export type CreateErpSupplier = z.infer<typeof createErpSupplierSchema>;

export const updateErpSupplierSchema = createErpSupplierSchema.partial();
export type UpdateErpSupplier = z.infer<typeof updateErpSupplierSchema>;

export const createErpProductSchema = z.object({
  code: codeSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  ncm: z.string().max(12).optional().nullable(),
  cest: z.string().max(12).optional().nullable(),
  unit: z.string().min(1).max(10).optional().default("UN"),
  priceCents: z.number().int().nonnegative().optional().nullable(),
  costCents: z.number().int().nonnegative().optional().nullable(),
  status: z.enum(PRODUCT_STATUSES).optional().default("active"),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateErpProduct = z.infer<typeof createErpProductSchema>;

export const updateErpProductSchema = createErpProductSchema.partial();
export type UpdateErpProduct = z.infer<typeof updateErpProductSchema>;

export const createErpAccountSchema = z.object({
  code: codeSchema,
  name: z.string().min(1).max(200),
  accountType: z.enum(ACCOUNT_TYPES),
  parentId: z.string().guid().optional().nullable(),
  status: z.enum(MASTER_ENTITY_STATUSES).optional().default("active"),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateErpAccount = z.infer<typeof createErpAccountSchema>;

export const updateErpAccountSchema = createErpAccountSchema.partial();
export type UpdateErpAccount = z.infer<typeof updateErpAccountSchema>;
