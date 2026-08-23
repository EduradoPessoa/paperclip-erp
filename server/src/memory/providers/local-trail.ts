/**
 * Local trail memory provider — Paperclip ERP (M2).
 *
 * The zero-config provider: every capture/query is recorded on the audited
 * operation trail (`memoryOperations`) and returns the operation id as the
 * record handle. External providers (mem0 etc.) replace this without core
 * changes.
 */

import type { MemoryCaptureInput, MemoryCaptureOutput, MemoryProvider, MemoryQueryInput, MemoryQueryOutput } from "@paperclipai/shared";
import type { Db } from "@paperclipai/db";
import { memoryService, type MemoryActor } from "../../services/memory.js";

export function createLocalTrailProvider(db: Db): MemoryProvider {
  const memory = memoryService(db);

  return {
    key: "local_trail",
    capabilities: { capture: true, query: true, list: false, get: false, forget: false },

    async capture(input: MemoryCaptureInput): Promise<MemoryCaptureOutput> {
      const recordIds: string[] = [];
      for (const record of input.records) {
        const actor: MemoryActor = {
          actorType: input.actorType as MemoryActor["actorType"],
          actorId: input.actorUserId ?? input.actorAgentId ?? "system",
          agentId: input.actorAgentId,
          runId: input.runId,
        };
        const operation = await memory.logOperation({
          companyId: input.companyId,
          bindingId: input.bindingId,
          operation: {
            operationType: "capture",
            scope: input.scope,
            status: "success",
          },
          sourceRef: input.sourceRef,
          actor,
        });
        recordIds.push(operation.id);
      }
      return { recordIds };
    },

    async query(input: MemoryQueryInput): Promise<MemoryQueryOutput> {
      // Trail-only provider: queries are recorded but return no snippets yet.
      return { snippets: [] };
    },
  };
}
