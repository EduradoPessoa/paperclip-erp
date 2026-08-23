/**
 * Execution memory routes — Paperclip ERP (M1: control plane).
 *
 * Bindings and targets are board-managed; the operation trail is written by
 * board and by agents (attributed to the run when present) and read by any
 * authenticated actor with company access.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createMemoryOperationSchema,
  setMemoryTargetSchema,
  upsertMemoryBindingSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logActivity, memoryService } from "../services/index.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { badRequest } from "../errors.js";
import type { MemoryActor } from "../services/memory.js";

function parseLimit(raw: unknown, fallback = 100) {
  if (raw == null || raw === "") return fallback;
  const limit = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 500) throw badRequest("invalid 'limit'");
  return limit;
}

function parseOffset(raw: unknown) {
  if (raw == null || raw === "") return 0;
  const offset = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(offset) || offset < 0) throw badRequest("invalid 'offset'");
  return offset;
}

function toMemoryActor(actor: ReturnType<typeof getActorInfo>): MemoryActor {
  return {
    actorType: actor.actorType,
    actorId: actor.actorId,
    agentId: actor.agentId,
    runId: actor.runId,
  };
}

export function memoryRoutes(db: Db) {
  const router = Router();
  const memory = memoryService(db);

  router.get("/companies/:companyId/memory/bindings", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    res.json(await memory.listBindings(companyId));
  });

  router.put(
    "/companies/:companyId/memory/bindings",
    validate(upsertMemoryBindingSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const binding = await memory.upsertBinding(companyId, req.body, toMemoryActor(actor));
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "memory.binding_upserted",
        entityType: "memory_binding",
        entityId: binding.id,
        details: { bindingKey: binding.bindingKey, providerKey: binding.providerKey, enabled: binding.enabled },
      });
      res.json(binding);
    },
  );

  router.delete("/companies/:companyId/memory/bindings/:bindingKey", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const actor = getActorInfo(req);
    const result = await memory.deleteBinding(companyId, req.params.bindingKey as string);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "memory.binding_deleted",
      entityType: "memory_binding",
      entityId: req.params.bindingKey as string,
    });
    res.json(result);
  });

  router.put(
    "/companies/:companyId/memory/targets/:targetType/:targetId",
    validate(setMemoryTargetSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const targetType = req.params.targetType as "company" | "agent";
      if (targetType !== "company" && targetType !== "agent") {
        throw badRequest("targetType must be 'company' or 'agent'");
      }
      const actor = getActorInfo(req);
      const target = await memory.setTarget({
        companyId,
        bindingKey: req.body.bindingKey,
        targetType,
        targetId: req.params.targetId as string,
      });
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "memory.target_set",
        entityType: "memory_binding_target",
        entityId: target.id,
        details: { targetType, targetId: req.params.targetId, bindingKey: req.body.bindingKey },
      });
      res.json(target);
    },
  );

  router.delete("/companies/:companyId/memory/targets/:targetType/:targetId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const targetType = req.params.targetType as "company" | "agent";
    if (targetType !== "company" && targetType !== "agent") {
      throw badRequest("targetType must be 'company' or 'agent'");
    }
    const actor = getActorInfo(req);
    const result = await memory.clearTarget({
      companyId,
      targetType,
      targetId: req.params.targetId as string,
    });
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "memory.target_cleared",
      entityType: "memory_binding_target",
      entityId: req.params.targetId as string,
    });
    res.json(result);
  });

  router.post(
    "/companies/:companyId/memory/operations",
    validate(createMemoryOperationSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertAuthenticated(req);
      const actor = getActorInfo(req);
      if (actor.actorType === "agent" && !actor.runId) {
        throw badRequest("Agent memory operations require an active run (attribution)");
      }

      let binding;
      if (req.body.bindingKey) {
        const bindings = await memory.listBindings(companyId);
        binding = bindings.bindings.find((b) => b.bindingKey === req.body.bindingKey && b.enabled);
        if (!binding) throw badRequest(`Memory binding "${req.body.bindingKey}" not found or disabled`);
      } else {
        binding = await memory.resolveBinding(companyId, { agentId: actor.agentId });
      }

      const row = await memory.logOperation({
        companyId,
        bindingId: binding.id,
        operation: req.body,
        actor: toMemoryActor(actor),
      });
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "memory.operation_logged",
        entityType: "memory_operation",
        entityId: row.id,
        details: { operationType: row.operationType, bindingKey: binding.bindingKey },
      });
      res.status(201).json(row);
    },
  );

  router.get("/companies/:companyId/memory/operations", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertAuthenticated(req);
    const operationType = typeof req.query.operationType === "string" ? req.query.operationType : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json(
      await memory.listOperations(companyId, {
        limit: parseLimit(req.query.limit),
        offset: parseOffset(req.query.offset),
        operationType,
        status,
      }),
    );
  });

  return router;
}
