import { describe, expect, it } from "vitest";
import { installErpModuleSchema, updateErpModuleSchema } from "./erp-module.js";
import { buildErpModulePermission, isErpPermissionKey } from "../erp-permissions.js";

describe("erp module validators", () => {
  it("accepts a valid module install", () => {
    const parsed = installErpModuleSchema.parse({
      moduleKey: "fiscal",
      config: { provider: "spedy" },
    });
    expect(parsed.moduleKey).toBe("fiscal");
    expect(parsed.enabled).toBe(true);
  });

  it("rejects unknown module keys", () => {
    expect(() => installErpModuleSchema.parse({ moduleKey: "crm" })).toThrow();
  });

  it("accepts partial module updates", () => {
    expect(updateErpModuleSchema.parse({ enabled: false }).enabled).toBe(false);
    expect(updateErpModuleSchema.parse({}).enabled).toBeUndefined();
  });
});

describe("erp permission keys", () => {
  it("builds module-scoped permission keys", () => {
    expect(buildErpModulePermission("purchasing", "approve")).toBe("erp:purchasing:approve");
  });

  it("detects erp-prefixed permission keys", () => {
    expect(isErpPermissionKey("erp:purchasing:approve")).toBe(true);
    expect(isErpPermissionKey("tasks:assign")).toBe(false);
  });
});
