import { describe, expect, it } from "vitest";
import {
  mapActivityToEntry,
  mapCostToEntry,
  mapRunEventToEntry,
  mapWorkProductToEntry,
} from "./run-timeline.js";

describe("run timeline mappers", () => {
  it("maps a heartbeat run event to a timeline entry", () => {
    const entry = mapRunEventToEntry({
      at: new Date("2026-08-23T10:00:00Z"),
      seq: 3,
      eventType: "tool_call",
      level: "info",
      message: "read file x.ts",
      payload: { tool: "read" },
    });
    expect(entry.kind).toBe("run_event");
    expect(entry.seq).toBe(3);
    expect(entry.title).toBe("tool_call");
    expect(entry.summary).toBe("read file x.ts");
    expect(entry.detail).toEqual({ tool: "read" });
  });

  it("maps audited activity to a timeline entry", () => {
    const entry = mapActivityToEntry({
      at: new Date("2026-08-23T10:01:00Z"),
      action: "issue.commented",
      entityType: "issue",
      entityId: "abc",
      details: { body: "done" },
    });
    expect(entry.kind).toBe("activity");
    expect(entry.title).toBe("issue.commented");
    expect(entry.summary).toBe("issue:abc");
  });

  it("maps a cost event to a timeline entry with totals", () => {
    const entry = mapCostToEntry({
      at: new Date("2026-08-23T10:02:00Z"),
      provider: "openai",
      model: "gpt-5",
      inputTokens: 100,
      cachedInputTokens: 50,
      outputTokens: 20,
      costCents: 12,
    });
    expect(entry.kind).toBe("cost");
    expect(entry.summary).toBe("170 tokens · 0.12");
    expect(entry.detail).toMatchObject({ costCents: 12, inputTokens: 100 });
  });

  it("maps a work product to a timeline entry", () => {
    const entry = mapWorkProductToEntry({
      at: new Date("2026-08-23T10:03:00Z"),
      title: "report.pdf",
      issueId: "issue-1",
    });
    expect(entry.kind).toBe("work_product");
    expect(entry.title).toBe("report.pdf");
    expect(entry.summary).toBe("issue:issue-1");
  });
});
