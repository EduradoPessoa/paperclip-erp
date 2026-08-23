import { describe, expect, it } from "vitest";
import { buildMemoryScopeForRun } from "./memory-hooks.js";
import { registerMemoryProviderFactory, getMemoryProviderFactory, hasMemoryProviderFactory } from "../memory/registry.js";

describe("memory hooks (M2)", () => {
  it("builds a run scope with attribution", () => {
    const scope = buildMemoryScopeForRun({
      companyId: "c1",
      agentId: "a1",
      runId: "r1",
    });
    expect(scope).toMatchObject({ companyId: "c1", agentId: "a1", runId: "r1" });
    expect(scope.issueId).toBeNull();
  });

  it("registers and resolves memory provider factories", () => {
    registerMemoryProviderFactory("test-memory", () => {
      throw new Error("not instantiated in this test");
    });
    expect(hasMemoryProviderFactory("test-memory")).toBe(true);
    expect(typeof getMemoryProviderFactory("test-memory")).toBe("function");
    expect(() => getMemoryProviderFactory("missing-provider")).toThrow(/not registered/);
  });
});
