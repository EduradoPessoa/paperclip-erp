import { describe, expect, it } from "vitest";
import { decideErpPermission } from "./erp-permissions.js";
import { updateMemberPermissionsSchema } from "@paperclipai/shared";

describe("ERP module RBAC (enforcement)", () => {
  it("lets board actors pass and agents require grants", () => {
    expect(decideErpPermission({ actorType: "board", hasGrant: false })).toBe(true);
    expect(decideErpPermission({ actorType: "agent", hasGrant: true })).toBe(true);
    expect(decideErpPermission({ actorType: "agent", hasGrant: false })).toBe(false);
    expect(decideErpPermission({ actorType: "user", hasGrant: true })).toBe(false);
  });

  it("accepts erp-prefixed permission keys in grants", () => {
    const parsed = updateMemberPermissionsSchema.parse({
      grants: [{ permissionKey: "erp:purchasing:manage" }],
    });
    expect(parsed.grants[0]?.permissionKey).toBe("erp:purchasing:manage");
  });

  it("still accepts core permission keys", () => {
    const parsed = updateMemberPermissionsSchema.parse({
      grants: [{ permissionKey: "tasks:assign" }],
    });
    expect(parsed.grants[0]?.permissionKey).toBe("tasks:assign");
  });

  it("rejects malformed erp keys", () => {
    expect(() =>
      updateMemberPermissionsSchema.parse({ grants: [{ permissionKey: "erp:noAction" }] }),
    ).toThrow();
  });
});
