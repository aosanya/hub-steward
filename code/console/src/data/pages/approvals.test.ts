import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { pageModule } from "../registry";
import { approvalFacts, approvalKindLabel, approvalLog, approvalsPage, decideAllPending, isChangedSinceRead } from "./approvals";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const everyone = {
  items: [
    { id: "a1", kind: "access_request", summary: "Seed access for Akinyi", status: "pending", proposed_by: "akinyi" },
    { id: "a2", kind: "access_request", summary: "Tools for Akinyi", status: "pending", proposed_by: "akinyi" },
    { id: "a3", kind: "access_request", summary: "Tools for Otieno", status: "pending", proposed_by: "otieno" },
  ],
};

const calls = () => vi.mocked(callTool).mock.calls.map((call) => ({ tool: call[1], args: call[2] as Record<string, unknown> }));

const decideCalls = () => calls().filter((call) => call.tool === "agency_decide_approval");

const decide = (values: Record<string, unknown>) => approvalsPage.actions!.decide("h1", values);

const answerWith = (failing: string[] = []) =>
  vi.mocked(callTool).mockImplementation(async (_hubId, tool, args) => {
    if (tool === "agency_list_approvals") return everyone as never;
    if (tool === "agency_decide_approval") {
      if (failing.includes(String(args?.approval_id))) throw new Error("already decided");
      return {} as never;
    }
    return [] as never;
  });

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  answerWith();
});

describe("the approvals page", () => {
  it("is registered with its two tools, five columns and a decide action", () => {
    expect(pageModule("approvals")).toBe(approvalsPage);
    expect(approvalsPage.spec.id).toBe("approvals");
    expect(approvalsPage.spec.title).toBe("Approvals");
    expect(approvalsPage.spec.tools).toEqual(["agency_list_approvals", "agency_decide_approval"]);
    expect(approvalsPage.spec.columns.map((column) => column.key)).toEqual(["summary", "kind", "proposed_by", "proposed_at", "status"]);
    expect(approvalsPage.spec.columns.map((column) => column.label)).toEqual(["Request", "Kind", "Asked by", "Asked", "State"]);
    expect(Object.keys(approvalsPage.actions ?? {})).toEqual(["decide"]);
  });

  it("asks for refused requests when the declined state is asked for", async () => {
    const rows = await approvalsPage.rows("h1", { state: "declined" });
    expect(rows).toHaveLength(3);
    expect(calls()[0].args).toEqual({ status: "refused" });
  });

  it("asks for pending and for approved requests under the same names", async () => {
    await approvalsPage.rows("h1", { state: "pending" });
    await approvalsPage.rows("h1", { state: "approved" });
    expect(calls().map((call) => call.args)).toEqual([{ status: "pending" }, { status: "approved" }]);
  });

  it("asks for all requests when no state is given", async () => {
    await approvalsPage.rows("h1", {});
    expect(calls()[0].args).toEqual({});
    expect("status" in calls()[0].args).toBe(false);
  });

  it("asks nothing and lists nothing for a state it does not know", async () => {
    const rows = await approvalsPage.rows("h1", { state: "bogus" });
    expect(rows).toEqual([]);
    expect(calls()).toEqual([]);
    expect(await approvalsPage.rows("h1", { state: "constructor" })).toEqual([]);
  });

  it("keeps only the requests asked by the requester when one is given", async () => {
    const rows = await approvalsPage.rows("h1", { state: "pending", requester: "akinyi" });
    expect(rows.map((row) => row.id)).toEqual(["a1", "a2"]);
  });

  it("sends the hub's id with the tool", async () => {
    await approvalsPage.rows("h1", {});
    expect(vi.mocked(callTool).mock.calls[0][0]).toBe("h1");
  });

  it("passes the tool's error on", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("down"));
    await expect(approvalsPage.rows("h1", {})).rejects.toThrow("down");
  });
});

describe("deciding approvals", () => {
  it("decides every pending request of one requester, leaves the others alone and reports the one that failed", async () => {
    answerWith(["a2"]);
    const out = await decideAllPending("h1", "akinyi", "approved", "");
    expect(out.decided).toEqual(["a1"]);
    expect(out.failed).toEqual([{ id: "a2", error: "already decided" }]);
    expect(decideCalls().map((call) => call.args)).toEqual([
      { approval_id: "a1", decision: "approved", seen_amendments: 0 },
      { approval_id: "a2", decision: "approved", seen_amendments: 0 },
    ]);
  });

  it("lists only the requester's pending requests before it decides", async () => {
    await decideAllPending("h1", "akinyi", "refused", "not now");
    expect(calls()[0]).toEqual({ tool: "agency_list_approvals", args: { status: "pending" } });
    expect(decideCalls().map((call) => call.args)).toEqual([
      { approval_id: "a1", decision: "refused", reason: "not now", seen_amendments: 0 },
      { approval_id: "a2", decision: "refused", reason: "not now", seen_amendments: 0 },
    ]);
  });

  it("sends approved for one request and answers done", async () => {
    expect(await decide({ id: "a1", decision: "approved", seen_amendments: 0 })).toBe("done");
    expect(calls()).toEqual([{ tool: "agency_decide_approval", args: { approval_id: "a1", decision: "approved", seen_amendments: 0 } }]);
    expect(vi.mocked(callTool).mock.calls[0][0]).toBe("h1");
  });

  it("sends refused with the reason when one is given", async () => {
    expect(await decide({ id: "a1", decision: "refused", reason: "not now", seen_amendments: 0 })).toBe("done");
    expect(decideCalls()[0].args).toEqual({ approval_id: "a1", decision: "refused", reason: "not now", seen_amendments: 0 });
  });

  it("decides all of a requester's pending requests when it is given a requester and no id", async () => {
    expect(await decide({ requester: "akinyi", decision: "approved" })).toBe("done");
    expect(decideCalls().map((call) => call.args.approval_id)).toEqual(["a1", "a2"]);
  });

  it("refuses a decision other than approved or refused before asking anything", async () => {
    await expect(decide({ id: "a1", decision: "maybe" })).rejects.toThrow("that was not understood");
    await expect(decide({ id: "a1" })).rejects.toThrow("that was not understood");
    expect(calls()).toEqual([]);
  });

  it("refuses a decision with neither an id nor a requester before asking anything", async () => {
    await expect(decide({ decision: "approved" })).rejects.toThrow("id or requester is required");
    await expect(decide({ id: "  ", requester: " ", decision: "approved" })).rejects.toThrow("id or requester is required");
    expect(calls()).toEqual([]);
  });

  it("binds a single decision to the amendment count the approver read", async () => {
    await decide({ id: "a1", decision: "approved", seen_amendments: 2 });
    expect(decideCalls()[0].args).toEqual({ approval_id: "a1", decision: "approved", seen_amendments: 2 });
  });

  it("refuses a decision on one request that does not name how many amendments were read, before asking anything", async () => {
    await expect(decide({ id: "a1", decision: "approved" })).rejects.toThrow("seen_amendments is required");
    await expect(decide({ id: "a1", decision: "refused", seen_amendments: "2" })).rejects.toThrow("seen_amendments is required");
    expect(calls()).toEqual([]);
  });

  it("binds a decision of zero amendments too", async () => {
    await decide({ id: "a1", decision: "approved", seen_amendments: 0 });
    expect(decideCalls()[0].args).toEqual({ approval_id: "a1", decision: "approved", seen_amendments: 0 });
  });

  it("binds each request decided together to the amendments its own listing row carries", async () => {
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
      if (tool === "agency_list_approvals") {
        return {
          items: [
            { id: "a1", status: "pending", proposed_by: "akinyi", amendments: "" },
            { id: "a2", status: "pending", proposed_by: "akinyi", amendments: JSON.stringify([{ by: "agent" }, { by: "agent" }]) },
          ],
        } as never;
      }
      return {} as never;
    });
    await decideAllPending("h1", "akinyi", "approved", "");
    expect(decideCalls().map((call) => call.args)).toEqual([
      { approval_id: "a1", decision: "approved", seen_amendments: 0 },
      { approval_id: "a2", decision: "approved", seen_amendments: 2 },
    ]);
  });

  it("binds a request whose listing row carries no amendments key to zero", async () => {
    await decideAllPending("h1", "otieno", "approved", "");
    expect(decideCalls().map((call) => call.args)).toEqual([{ approval_id: "a3", decision: "approved", seen_amendments: 0 }]);
  });

  it("recognises the answer that says the request changed after it was read", () => {
    const refusal = new McpError("agency_decide_approval: the approval changed after it was read, so read it again before deciding");
    expect(isChangedSinceRead(refusal)).toBe(true);
    expect(isChangedSinceRead(new McpError("agency_decide_approval: already decided"))).toBe(false);
    expect(isChangedSinceRead(new TypeError("network down"))).toBe(false);
  });

  it("fails when the tool refuses the decision", async () => {
    answerWith(["a1"]);
    await expect(decide({ id: "a1", decision: "approved", seen_amendments: 0 })).rejects.toThrow("already decided");
  });

  it("fails as signed out when the hub's session is gone", async () => {
    vi.mocked(callTool).mockRejectedValue(new McpError("not signed in", true));
    await expect(decide({ id: "a1", decision: "approved", seen_amendments: 0 })).rejects.toMatchObject({ unauthorized: true });
  });
});

describe("the facts the approvals page draws from a request", () => {
  const akinyi = {
    id: "a1",
    kind: "access_request",
    summary: "Access for member m-1",
    proposed_by: "Hub Steward",
    proposed_at: "2026-10-27T09:20:00Z",
    payload: JSON.stringify({ name: "Akinyi Otieno", language: "Kiswahili", seat: true }),
  };

  it("names the member the request is for when the payload says so, and the one who drafted it", () => {
    expect(approvalFacts(akinyi)).toMatchObject({
      who: "Akinyi Otieno",
      named: true,
      proposer: "Hub Steward",
      language: "Kiswahili",
      proposedAt: "2026-10-27T09:20:00Z",
    });
  });

  it("falls back to the one who drafted the request when the payload names nobody", () => {
    expect(approvalFacts({ ...akinyi, payload: "{}" })).toMatchObject({ who: "Hub Steward", named: false });
    expect(approvalFacts({ ...akinyi, payload: undefined }).who).toBe("Hub Steward");
    expect(approvalFacts({ ...akinyi, payload: "not json" }).who).toBe("Hub Steward");
    expect(approvalFacts({ ...akinyi, payload: "[1]" }).who).toBe("Hub Steward");
  });

  it("leaves the language out when it is English or not given", () => {
    expect(approvalFacts({ ...akinyi, payload: JSON.stringify({ language: "English" }) }).language).toBe("");
    expect(approvalFacts({ ...akinyi, payload: JSON.stringify({ language: "en" }) }).language).toBe("");
    expect(approvalFacts({ ...akinyi, payload: JSON.stringify({}) }).language).toBe("");
  });

  it("writes the kind as words with a capital", () => {
    expect(approvalKindLabel("access_request")).toBe("Access request");
    expect(approvalKindLabel("seat-booking")).toBe("Seat booking");
    expect(approvalKindLabel("")).toBe("");
    expect(approvalFacts(akinyi).kind).toBe("Access request");
  });

  it("carries who decided the request, when and why", () => {
    const decided = approvalFacts({ ...akinyi, decided_by: "Lab manager", decided_at: "2026-10-27T10:42:00Z", reason: "Fits the booking rules" });
    expect(decided).toMatchObject({ decidedBy: "Lab manager", decidedAt: "2026-10-27T10:42:00Z", reason: "Fits the booking rules" });
  });
});

describe("deciding all of a member's requests", () => {
  it("matches the member's name in the payload, ignoring case", async () => {
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) =>
      tool === "agency_list_approvals"
        ? ({
            items: [
              { id: "n1", status: "pending", proposed_by: "Hub Steward", payload: JSON.stringify({ name: "Akinyi Otieno" }) },
              { id: "n2", status: "pending", proposed_by: "Hub Steward", payload: JSON.stringify({ name: "Otieno" }) },
            ],
          } as never)
        : ({} as never),
    );
    const out = await decideAllPending("h1", "akinyi otieno", "approved", "");
    expect(out).toEqual({ decided: ["n1"], failed: [] });
  });
});

describe("the log of a request", () => {
  it("is empty of a decision while the request is pending", () => {
    const log = approvalLog({ id: "p1", status: "pending", proposed_by: "Hub Steward", proposed_at: "2026-10-26T09:20:00" });
    expect(log.map((entry) => entry.step)).toEqual(["drafted"]);
  });

  it("ignores amendments that are not a list", () => {
    expect(approvalLog({ id: "p1", status: "pending", proposed_by: "x", amendments: "{broken" })).toHaveLength(1);
  });
});

describe("the steps taken after approving", () => {
  const approved = {
    id: "p1",
    status: "approved",
    proposed_by: "Hub Steward",
    proposed_at: "2026-10-26T09:20:00",
    decided_by: "Lab manager",
    decided_at: "2026-10-26T10:42:07",
  };
  const taken = (steps: unknown) => JSON.stringify(steps);

  it("follow the decision, each with its own time, who and words from the request", () => {
    const log = approvalLog({
      ...approved,
      applied: taken([
        { at: "2026-10-26T10:42:09", by: "Lab manager", step: "Filed the source \"Rules\"" },
        { at: "2026-10-26T10:42:10", by: "Lab manager", step: "Added the text of \"Rules\" to the source" },
      ]),
    });
    expect(log.map((entry) => [entry.step, entry.at, entry.by, entry.said])).toEqual([
      ["drafted", "2026-10-26T09:20:00", "Hub Steward", ""],
      ["approved", "2026-10-26T10:42:07", "Lab manager", ""],
      ["taken", "2026-10-26T10:42:09", "Lab manager", "Filed the source \"Rules\""],
      ["taken", "2026-10-26T10:42:10", "Lab manager", "Added the text of \"Rules\" to the source"],
    ]);
  });

  it("carry no tool, because the request does not name one", () => {
    const log = approvalLog({ ...approved, applied: taken([{ at: "2026-10-26T10:42:09", by: "Lab manager", step: "Carried out access_request" }]) });
    expect(log.at(-1)?.tool).toBe("");
  });

  it("are left out when the request has none, or when they are not a list", () => {
    expect(approvalLog({ ...approved, applied: "" })).toHaveLength(2);
    expect(approvalLog({ ...approved, applied: "{broken" })).toHaveLength(2);
    expect(approvalLog({ ...approved, applied: "{}" })).toHaveLength(2);
  });

  it("leave out an entry that says nothing", () => {
    const log = approvalLog({ ...approved, applied: taken([{ at: "2026-10-26T10:42:09", by: "Lab manager", step: "  " }, { at: "x", by: "y" }]) });
    expect(log).toHaveLength(2);
  });
});
