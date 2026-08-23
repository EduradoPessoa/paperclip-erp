/**
 * Fiscal routes — Paperclip ERP.
 *
 * F1 access model: reads require any authenticated actor with company access
 * (company-scoped visibility); mutations (create/transmit/consult/cancel and
 * provider bindings) require board access — agent execution paths arrive with
 * the module skills in a later phase, always through the human-in-the-loop
 * protocol.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  cancelFiscalDocumentSchema,
  createFiscalDocumentSchema,
  fiscalProviderBindingSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { fiscalService, logActivity } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { registerBuiltinFiscalProviders } from "../fiscal/index.js";
import { badRequest } from "../errors.js";
import type { FiscalActor } from "../services/fiscal.js";

registerBuiltinFiscalProviders();

function parseLimit(raw: unknown, fallback = 100) {
  if (raw == null || raw === "") return fallback;
  const limit = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 500) {
    throw badRequest("invalid 'limit' value");
  }
  return limit;
}

function parseOffset(raw: unknown) {
  if (raw == null || raw === "") return 0;
  const offset = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(offset) || offset < 0) throw badRequest("invalid 'offset' value");
  return offset;
}

function toFiscalActor(actor: ReturnType<typeof getActorInfo>): FiscalActor {
  return {
    actorType: actor.actorType,
    actorId: actor.actorId,
    agentId: actor.agentId,
    runId: actor.runId,
  };
}

export function fiscalRoutes(db: Db) {
  const router = Router();
  const fiscal = fiscalService(db);

  router.post(
    "/companies/:companyId/fiscal/documents",
    validate(createFiscalDocumentSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const detail = await fiscal.createDraft(companyId, req.body, toFiscalActor(actor));
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "fiscal.document_created",
        entityType: "fiscal_document",
        entityId: detail.document.id,
        details: {
          model: detail.document.model,
          accessKey: detail.document.accessKey,
          status: detail.document.status,
        },
      });
      res.status(201).json(detail);
    },
  );

  router.get("/companies/:companyId/fiscal/documents", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const model = typeof req.query.model === "string" ? req.query.model : undefined;
    const rows = await fiscal.list(companyId, {
      status,
      model,
      limit: parseLimit(req.query.limit),
      offset: parseOffset(req.query.offset),
    });
    res.json(rows);
  });

  router.get("/companies/:companyId/fiscal/documents/:documentId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    const detail = await fiscal.getDetail(companyId, req.params.documentId as string);
    res.json(detail);
  });

  router.get("/companies/:companyId/fiscal/documents/:documentId/events", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    const events = await fiscal.listEvents(companyId, req.params.documentId as string);
    res.json(events);
  });

  router.post(
    "/companies/:companyId/fiscal/documents/:documentId/transmit",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await fiscal.transmit(companyId, req.params.documentId as string, toFiscalActor(actor));
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "fiscal.document_transmitted",
        entityType: "fiscal_document",
        entityId: result.document.document.id,
        details: {
          status: result.document.document.status,
          providerKey: result.document.document.providerKey,
          providerResult: result.providerResult.status,
        },
      });
      res.json(result);
    },
  );

  router.post(
    "/companies/:companyId/fiscal/documents/:documentId/consult",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await fiscal.consult(companyId, req.params.documentId as string, toFiscalActor(actor));
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "fiscal.document_consulted",
        entityType: "fiscal_document",
        entityId: result.document.document.id,
        details: { status: result.document.document.status },
      });
      res.json(result);
    },
  );

  router.post(
    "/companies/:companyId/fiscal/documents/:documentId/cancel",
    validate(cancelFiscalDocumentSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const result = await fiscal.cancel(
        companyId,
        req.params.documentId as string,
        req.body.justification,
        toFiscalActor(actor),
      );
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "fiscal.document_cancelled",
        entityType: "fiscal_document",
        entityId: result.document.document.id,
        details: { status: result.document.document.status },
      });
      res.json(result);
    },
  );

  router.get("/companies/:companyId/fiscal/provider-bindings", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await fiscal.listBindings(companyId));
  });

  router.put(
    "/companies/:companyId/fiscal/provider-bindings",
    validate(fiscalProviderBindingSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const binding = await fiscal.upsertBinding(companyId, req.body, toFiscalActor(actor));
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "fiscal.provider_binding_upserted",
        entityType: "fiscal_provider_binding",
        entityId: binding.id,
        details: { providerKey: binding.providerKey, enabled: binding.enabled },
      });
      res.json(binding);
    },
  );

  return router;
}
