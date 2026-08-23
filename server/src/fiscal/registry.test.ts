import { describe, expect, it } from "vitest";
import { registerFiscalProviderFactory, getFiscalProviderFactory, hasFiscalProviderFactory, listFiscalProviderKeys } from "./registry.js";
import type { FiscalProvider } from "./provider.js";

function makeStubProvider(key: string): FiscalProvider {
  return {
    key: key as never,
    capabilities: { documentModels: ["nfe"], danfe: false, webhooks: false, splitPayment: false },
    emit: async () => ({ status: "transmitted", providerDocumentId: "stub" }),
    cancel: async () => ({ status: "cancelled" }),
    invalidate: async () => ({ status: "invalidated" }),
    consult: async () => ({ status: "transmitted" }),
    fetchByAccessKey: async () => ({ status: "authorized" }),
    manifest: async () => ({ status: "ok" }),
    downloadXml: async () => ({ content: new Uint8Array(), contentType: "application/xml", filename: "x.xml" }),
    downloadDanfe: async () => ({ content: new Uint8Array(), contentType: "application/pdf", filename: "x.pdf" }),
    listEvents: async () => [],
  };
}

describe("fiscal provider registry", () => {
  it("registers and resolves a provider factory by key", () => {
    registerFiscalProviderFactory("test-stub", () => makeStubProvider("test-stub"));
    expect(hasFiscalProviderFactory("test-stub")).toBe(true);
    expect(listFiscalProviderKeys()).toContain("test-stub");
    const provider = getFiscalProviderFactory("test-stub")({
      baseUrl: "https://example.test",
      environment: "homologation",
    });
    expect(provider.key).toBe("test-stub");
  });

  it("throws for unknown provider keys", () => {
    expect(() => getFiscalProviderFactory("does-not-exist")).toThrow(/not registered/);
  });
});
