/**
 * Execution memory service — Paperclip ERP.
 *
 * Control-plane contract: company-scoped bindings (company default + per-agent
 * override), binding resolution, and the audited operation trail. Providers
 * (extraction/storage/ranking) are wired in M2+; the operation log is
 * append-only by contract.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { memoryBindingTargets, memoryBindings, memoryOperations } from "@paperclipai/db";
import type {
  CreateMemoryOperation,
  MemoryScope,
  MemorySourceRef,
  UpsertMemoryBinding,
} from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";

export interface MemoryActor {
  actorType: "user" | "agent" | "system";
  actorId: string;
  agentId: string | null;
  runId: string | null;
}

export interface MemoryListOptions {
  limit: number;
  offset: number;
  operationType?: string;
  status?: string;
}

export function memoryService(db: Db) {
  async function getBinding(companyId: string, bindingKey: string) {
    const row = await db
      .select()
      .from(memoryBindings)
      .where(and(eq(memoryBindings.companyId, companyId), eq(memoryBindings.bindingKey, bindingKey)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound(`Memory binding "${bindingKey}" not found`);
    return row;
  }

  return {
    listBindings: async (companyId: string) => {
      const bindings = await db
        .select()
        .from(memoryBindings)
        .where(eq(memoryBindings.companyId, companyId))
        .orderBy(asc(memoryBindings.createdAt));
      const targets = await db
        .select()
        .from(memoryBindingTargets)
        .where(eq(memoryBindingTargets.companyId, companyId));
      return { bindings, targets };
    },

    upsertBinding: async (companyId: string, input: UpsertMemoryBinding, actor: MemoryActor) => {
      const [binding] = await db
        .insert(memoryBindings)
        .values({
          companyId,
          bindingKey: input.bindingKey,
          providerKey: input.providerKey,
          config: input.config,
          enabled: input.enabled,
          createdByUserId: actor.actorType === "user" ? actor.actorId : null,
          createdByAgentId: actor.actorType === "agent" ? actor.agentId : null,
        })
        .onConflictDoUpdate({
          target: [memoryBindings.companyId, memoryBindings.bindingKey],
          set: {
            providerKey: input.providerKey,
            config: input.config,
            enabled: input.enabled,
            updatedAt: new Date(),
          },
        })
        .returning();
      return binding;
    },

    deleteBinding: async (companyId: string, bindingKey: string) => {
      await getBinding(companyId, bindingKey);
      await db
        .delete(memoryBindings)
        .where(and(eq(memoryBindings.companyId, companyId), eq(memoryBindings.bindingKey, bindingKey)));
      return { ok: true };
    },

    setTarget: async (input: {
      companyId: string;
      bindingKey: string;
      targetType: "company" | "agent";
      targetId: string;
    }) => {
      const binding = await getBinding(input.companyId, input.bindingKey);
      const [target] = await db
        .insert(memoryBindingTargets)
        .values({
          companyId: input.companyId,
          bindingId: binding.id,
          targetType: input.targetType,
          targetId: input.targetId,
        })
        .onConflictDoUpdate({
          target: [memoryBindingTargets.targetType, memoryBindingTargets.targetId],
          set: { bindingId: binding.id, updatedAt: new Date() },
        })
        .returning();
      return target;
    },

    clearTarget: async (input: {
      companyId: string;
      targetType: "company" | "agent";
      targetId: string;
    }) => {
      await db
        .delete(memoryBindingTargets)
        .where(
          and(
            eq(memoryBindingTargets.companyId, input.companyId),
            eq(memoryBindingTargets.targetType, input.targetType),
            eq(memoryBindingTargets.targetId, input.targetId),
          ),
        );
      return { ok: true };
    },

    /**
     * Resolution order (M1): per-agent override target → company target →
     * first enabled binding. Returns the binding row.
     */
    resolveBinding: async (companyId: string, scope: { agentId?: string | null }) => {
      if (scope.agentId) {
        const agentTarget = await db
          .select({ bindingId: memoryBindingTargets.bindingId })
          .from(memoryBindingTargets)
          .where(
            and(
              eq(memoryBindingTargets.companyId, companyId),
              eq(memoryBindingTargets.targetType, "agent"),
              eq(memoryBindingTargets.targetId, scope.agentId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null);
        if (agentTarget) {
          const binding = await db
            .select()
            .from(memoryBindings)
            .where(and(eq(memoryBindings.id, agentTarget.bindingId), eq(memoryBindings.enabled, true)))
            .limit(1)
            .then((rows) => rows[0] ?? null);
          if (binding) return binding;
        }
      }

      const companyTarget = await db
        .select({ bindingId: memoryBindingTargets.bindingId })
        .from(memoryBindingTargets)
        .where(
          and(
            eq(memoryBindingTargets.companyId, companyId),
            eq(memoryBindingTargets.targetType, "company"),
            eq(memoryBindingTargets.targetId, companyId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (companyTarget) {
        const binding = await db
          .select()
          .from(memoryBindings)
          .where(and(eq(memoryBindings.id, companyTarget.bindingId), eq(memoryBindings.enabled, true)))
          .limit(1)
          .then((rows) => rows[0] ?? null);
        if (binding) return binding;
      }

      const fallback = await db
        .select()
        .from(memoryBindings)
        .where(and(eq(memoryBindings.companyId, companyId), eq(memoryBindings.enabled, true)))
        .orderBy(asc(memoryBindings.createdAt))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!fallback) {
        throw unprocessable(`No enabled memory binding for company ${companyId}`);
      }
      return fallback;
    },

    logOperation: async (input: {
      companyId: string;
      bindingId: string;
      operation: Omit<CreateMemoryOperation, "scope"> & { scope?: MemoryScope };
      sourceRef?: MemorySourceRef | null;
      actor: MemoryActor;
    }) => {
      const scope: MemoryScope = {
        companyId: input.companyId,
        agentId: input.operation.scope?.agentId ?? input.actor.agentId,
        projectId: input.operation.scope?.projectId ?? null,
        issueId: input.operation.scope?.issueId ?? null,
        runId: input.operation.scope?.runId ?? input.actor.runId,
        subjectId: input.operation.scope?.subjectId ?? null,
        sessionKey: input.operation.scope?.sessionKey ?? null,
        namespace: input.operation.scope?.namespace ?? null,
      };
      const [row] = await db
        .insert(memoryOperations)
        .values({
          companyId: input.companyId,
          bindingId: input.bindingId,
          operationType: input.operation.operationType,
          scope,
          sourceRef: input.sourceRef ?? input.operation.sourceRef ?? null,
          providerRecordId: input.operation.providerRecordId ?? null,
          status: input.operation.status ?? "success",
          error: input.operation.error ?? null,
          latencyMs: input.operation.latencyMs ?? null,
          usage: input.operation.usage ?? null,
          runId: scope.runId ?? null,
          actorType: input.actor.actorType,
          actorUserId: input.actor.actorType === "user" ? input.actor.actorId : null,
          actorAgentId: input.actor.actorType === "agent" ? input.actor.agentId : null,
        })
        .returning();
      return row;
    },

    listOperations: async (companyId: string, options: MemoryListOptions) => {
      const conditions = [eq(memoryOperations.companyId, companyId)];
      if (options.operationType) conditions.push(eq(memoryOperations.operationType, options.operationType));
      if (options.status) conditions.push(eq(memoryOperations.status, options.status));
      return db
        .select()
        .from(memoryOperations)
        .where(and(...conditions))
        .orderBy(desc(memoryOperations.createdAt))
        .limit(options.limit)
        .offset(options.offset);
    },
  };
}
