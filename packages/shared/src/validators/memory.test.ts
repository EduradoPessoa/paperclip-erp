import { describe, expect, it } from "vitest";
import {
  createMemoryOperationSchema,
  upsertMemoryBindingSchema,
} from "./memory.js";

describe("memory validators", () => {
  it("accepts a valid binding upsert", () => {
    const parsed = upsertMemoryBindingSchema.parse({
      bindingKey: "local-markdown",
      providerKey: "mem0",
      config: { apiKeySecretRef: "mem0-key" },
      enabled: true,
    });
    expect(parsed.bindingKey).toBe("local-markdown");
    expect(parsed.enabled).toBe(true);
  });

  it("rejects invalid binding keys", () => {
    expect(() =>
      upsertMemoryBindingSchema.parse({ bindingKey: "Bad Key!", providerKey: "mem0" }),
    ).toThrow();
  });

  it("accepts a memory operation with attribution scope", () => {
    const parsed = createMemoryOperationSchema.parse({
      operationType: "capture",
      scope: { agentId: "00000000-0000-0000-0000-000000000001", runId: "00000000-0000-0000-0000-000000000002" },
      sourceRef: { kind: "run", runId: "00000000-0000-0000-0000-000000000002" },
      status: "success",
    });
    expect(parsed.operationType).toBe("capture");
    expect(parsed.status).toBe("success");
  });

  it("rejects unknown operation types", () => {
    expect(() => createMemoryOperationSchema.parse({ operationType: "teleport" })).toThrow();
  });
});
