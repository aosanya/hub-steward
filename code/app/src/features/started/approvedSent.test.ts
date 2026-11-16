import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import * as me from "../../shared/wakala/me";
import * as mcp from "../../shared/wakala/mcp";
import { mcpDoneClient } from "./done";

const sentStep = (over: Record<string, unknown> = {}) => ({
  step_id: "s1",
  title: "Approve the permit",
  form_name: "Permit",
  workflow_name: "Permit",
  row_id: "r1",
  order_id: "",
  sent_at: "2026-10-21T10:00:00Z",
  answers: {},
  ...over,
});

const answeringSent = (rows: unknown[]) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => (tool === "agency_list_my_sent_steps" ? { items: rows } : { items: [] }) as any);

beforeEach(() => {
  vi.spyOn(me, "loadSubject").mockResolvedValue("m1");
  openAgency("farmers");
});

afterEach(() => {
  vi.restoreAllMocks();
  forgetOpenAgency();
});

describe("a sent step she approved", () => {
  it("shows the state as Approved by her name", async () => {
    answeringSent([sentStep({ answers: { "Approved by": "Anna Kovacs" } })]);
    const [row] = (await mcpDoneClient.read(null)).items;
    expect(row.state).toBe("Approved by Anna Kovacs");
  });

  it("still shows Sent for a step without that answer", async () => {
    answeringSent([sentStep({ answers: { Reason: "Needs a check" } })]);
    const [row] = (await mcpDoneClient.read(null)).items;
    expect(row.state).toBe("Sent");
  });

  it("shows Sent when the Approved by answer is empty", async () => {
    answeringSent([sentStep({ answers: { "Approved by": "" } })]);
    const [row] = (await mcpDoneClient.read(null)).items;
    expect(row.state).toBe("Sent");
  });
});
