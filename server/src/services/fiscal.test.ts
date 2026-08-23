import { describe, expect, it } from "vitest";
import { mapCallbackStatusToDocumentStatus, mapEmitStatusToDocumentStatus } from "./fiscal.js";

describe("fiscal status mapping", () => {
  it("maps emit results to document statuses", () => {
    expect(mapEmitStatusToDocumentStatus("authorized")).toBe("authorized");
    expect(mapEmitStatusToDocumentStatus("rejected")).toBe("rejected");
    expect(mapEmitStatusToDocumentStatus("denied")).toBe("denied");
    expect(mapEmitStatusToDocumentStatus("error")).toBe("error");
    expect(mapEmitStatusToDocumentStatus("transmitted")).toBe("transmitted");
    expect(mapEmitStatusToDocumentStatus("anything-else")).toBe("transmitted");
  });

  it("maps provider callback statuses to document statuses", () => {
    expect(mapCallbackStatusToDocumentStatus("authorized")).toBe("authorized");
    expect(mapCallbackStatusToDocumentStatus("cancelled")).toBe("cancelled");
    expect(mapCallbackStatusToDocumentStatus("invalidated")).toBe("invalidated");
    expect(mapCallbackStatusToDocumentStatus("rejected")).toBe("rejected");
    expect(mapCallbackStatusToDocumentStatus("denied")).toBe("denied");
    expect(mapCallbackStatusToDocumentStatus("error")).toBe("error");
    expect(mapCallbackStatusToDocumentStatus("processing")).toBe("transmitted");
  });
});
