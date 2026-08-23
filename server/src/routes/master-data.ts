/**
 * ERP master data routes — Paperclip ERP.
 *
 * Reads for any authenticated actor with company access; mutations are
 * board-managed and audited. Company scoping is enforced on every read/write.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createErpAccountSchema,
  createErpCustomerSchema,
  createErpProductSchema,
  createErpSupplierSchema,
  updateErpAccountSchema,
  updateErpCustomerSchema,
  updateErpProductSchema,
  updateErpSupplierSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logActivity, masterDataService } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { badRequest } from "../errors.js";
import type { MasterDataListOptions } from "../services/master-data.js";

function parseListOptions(query: Record<string, unknown>, fallbackLimit = 100): MasterDataListOptions {
  const limitRaw = query.limit;
  const limit = limitRaw == null || limitRaw === "" ? fallbackLimit : Number.parseInt(String(limitRaw), 10);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 500) throw badRequest("invalid 'limit'");
  const offsetRaw = query.offset;
  const offset = offsetRaw == null || offsetRaw === "" ? 0 : Number.parseInt(String(offsetRaw), 10);
  if (!Number.isFinite(offset) || offset < 0) throw badRequest("invalid 'offset'");
  return {
    q: typeof query.q === "string" && query.q ? query.q : undefined,
    status: typeof query.status === "string" && query.status ? query.status : undefined,
    limit,
    offset,
  };
}

type EntityKind = "customer" | "supplier" | "product" | "account";

/** Minimal row shape used at the route boundary for audit details. */
type MasterRow = { id: string; code: string; status: string };

function actionFor(kind: EntityKind, verb: string): string {
  return `erp.master_data.${kind}_${verb}`;
}

export function masterDataRoutes(db: Db) {
  const router = Router();
  const master = masterDataService(db);

  function entityRoutes(kind: EntityKind) {
    const base = `/companies/:companyId/erp/${kind === "customer" ? "customers" : kind === "supplier" ? "suppliers" : kind === "product" ? "products" : "chart-of-accounts"}`;
    const list = kind === "customer" ? master.listCustomers
      : kind === "supplier" ? master.listSuppliers
      : kind === "product" ? master.listProducts
      : master.listAccounts;
    const get = kind === "customer" ? master.getCustomer
      : kind === "supplier" ? master.getSupplier
      : kind === "product" ? master.getProduct
      : master.getAccount;
    const create = kind === "customer" ? master.createCustomer
      : kind === "supplier" ? master.createSupplier
      : kind === "product" ? master.createProduct
      : master.createAccount;
    const update = kind === "customer" ? master.updateCustomer
      : kind === "supplier" ? master.updateSupplier
      : kind === "product" ? master.updateProduct
      : master.updateAccount;
    const createSchema = kind === "customer" ? createErpCustomerSchema
      : kind === "supplier" ? createErpSupplierSchema
      : kind === "product" ? createErpProductSchema
      : createErpAccountSchema;
    const updateSchema = kind === "customer" ? updateErpCustomerSchema
      : kind === "supplier" ? updateErpSupplierSchema
      : kind === "product" ? updateErpProductSchema
      : updateErpAccountSchema;

    router.get(base, async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertAuthenticated(req);
      res.json(await list(companyId, parseListOptions(req.query)));
    });

    router.post(base, validate(createSchema), async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const row = (await create(companyId, req.body, actor.actorType === "user" ? actor.actorId : null)) as MasterRow;
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: actionFor(kind, "created"),
        entityType: `erp_${kind}`,
        entityId: row.id,
        details: { code: row.code, status: row.status },
      });
      res.status(201).json(row);
    });

    router.patch(`${base}/:id`, validate(updateSchema), async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const row = (await update(companyId, req.params.id as string, req.body)) as MasterRow;
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: actionFor(kind, "updated"),
        entityType: `erp_${kind}`,
        entityId: row.id,
        details: { code: row.code, status: row.status },
      });
      res.json(row);
    });

    router.get(`${base}/:id`, async (req, res) => {
      const companyId = (req.params as Record<string, string>).companyId;
      assertCompanyAccess(req, companyId);
      assertAuthenticated(req);
      res.json(await get(companyId, (req.params as Record<string, string>).id));
    });
  }

  entityRoutes("customer");
  entityRoutes("supplier");
  entityRoutes("product");
  entityRoutes("account");

  return router;
}
