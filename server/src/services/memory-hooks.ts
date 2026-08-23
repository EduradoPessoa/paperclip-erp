/**
 * Memory hooks — Paperclip ERP (M2).
 *
 * `pre_run_hydrate` (query before a run starts) and `post_run_capture`
 * (capture after a run finishes) resolve the company/agent binding, invoke the
 * bound provider and record the audited operation. Attribution always carries
 * the agent and run.
 */

import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { heartbeatRuns } from "@paperclipai/db";
import type { MemoryActor } from "./memory.js";
import { memoryService } from "./memory.js";
import { getMemoryProviderFactory } from "../memory/registry.js";
import { notFound, unprocessable } from "../errors.js";

export interface MemoryHookResult {
  providerKey: string;
  bindingId: string;
  recordIds: string[];
}

export interface RunHookActor extends MemoryActor {}

/** Pure helper: builds the memory scope for a run (exported for tests). */
export function buildMemoryScopeForRun(input: {
  companyId: string;
  agentId: string;
  runId: string;
}) {
  return {
    companyId: input.companyId,
    agentId: input.agentId,
    runId: input.runId,
    projectId: null,
    issueId: null,
    subjectId: null,
    sessionKey: null,
    namespace: null,
  };
}

export function memoryHooksService(db: Db) {
  const memory = memoryService(db);

  async function resolveRun(companyId: string, runId: string) {
    const run = await db
      .select()
      .from(heartbeatRuns)
      .where(and(eq(heartbeatRuns.id, runId), eq(heartbeatRuns.companyId, companyId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!run) throw notFound("Heartbeat run not found");
    return run;
  }

  return {
    hydrateForRun: async (companyId: string, runId: string, actor: RunHookActor): Promise<MemoryHookResult> => {
      const run = await resolveRun(companyId, runId);
      if (actor.actorType === "agent" && actor.agentId && actor.agentId !== run.agentId) {
        throw unprocessable("Agent can only hydrate its own runs");
      }
      const binding = await memory.resolveBinding(companyId, { agentId: run.agentId });
      const provider = getMemoryProviderFactory(binding.providerKey)(db);
      const scope = buildMemoryScopeForRun({ companyId, agentId: run.agentId, runId });
      const result = await provider.query({
        companyId,
        scope,
        query: `hydrate run ${runId}`,
        topK: 5,
      });
      await memory.logOperation({
        companyId,
        bindingId: binding.id,
        operation: { operationType: "query", scope, status: "success" },
        sourceRef: { kind: "run", runId },
        actor,
      });
      return { providerKey: binding.providerKey, bindingId: binding.id, recordIds: result.snippets.map((s) => s.handle) };
    },

    captureRun: async (
      companyId: string,
      runId: string,
      actor: RunHookActor,
      summary?: string | null,
    ): Promise<MemoryHookResult> => {
      const run = await resolveRun(companyId, runId);
      if (actor.actorType === "agent" && actor.agentId && actor.agentId !== run.agentId) {
        throw unprocessable("Agent can only capture its own runs");
      }
      const binding = await memory.resolveBinding(companyId, { agentId: run.agentId });
      const provider = getMemoryProviderFactory(binding.providerKey)(db);
      const scope = buildMemoryScopeForRun({ companyId, agentId: run.agentId, runId });
      const result = await provider.capture({
        companyId,
        bindingId: binding.id,
        scope,
        sourceRef: { kind: "run", runId },
        records: [
          {
            text: summary ?? `execução do run ${runId} (${run.status})`,
            summary: summary ?? null,
            metadata: { runStatus: run.status, invocationSource: run.invocationSource ?? null },
          },
        ],
        actorType: actor.actorType,
        actorUserId: actor.actorType === "user" ? actor.actorId : null,
        actorAgentId: actor.agentId,
        runId,
      });
      return { providerKey: binding.providerKey, bindingId: binding.id, recordIds: result.recordIds };
    },
  };
}
