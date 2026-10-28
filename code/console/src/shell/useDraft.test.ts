import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach } from "vitest";
import { callTool } from "../wakala/mcp";
import { useDraft } from "./useDraft";

vi.mock("../wakala/mcp");

type Args = Record<string, unknown>;

type Backend = {
  drafts: unknown[];
  approvals: unknown[];
  publications: unknown[];
  issues: unknown[];
  published: () => Promise<unknown>;
  unreadable: boolean;
};

const goalApproval = (id: string, decidedAt = "2026-10-27T10:00:00Z") => ({
  id,
  kind: "agency_create_goal",
  summary: "Add the goal " + id,
  status: "approved",
  decided_at: decidedAt,
});

const stored: Backend = {
  drafts: [],
  approvals: [],
  publications: [],
  issues: [],
  published: async () => ({}),
  unreadable: false,
};

let asked: { hubId: string; tool: string; args: Args }[] = [];

const startBackend = (over: Partial<Backend> = {}) => {
  Object.assign(stored, {
    drafts: [{ id: "d1", description: "Initial draft", status: "open" }],
    approvals: [],
    publications: [],
    issues: [],
    published: async () => ({ version: 1, tag: "v1", published_at: "2026-10-27T11:00:00Z" }),
    unreadable: false,
    ...over,
  });
  asked = [];
  vi.mocked(callTool).mockImplementation(async (hubId, tool, args = {}) => {
    asked.push({ hubId, tool, args });
    if (stored.unreadable) throw new Error("wakala answered 500: down");
    if (tool === "agency_list_drafts") return { items: stored.drafts } as never;
    if (tool === "agency_list_approvals") return { items: stored.approvals } as never;
    if (tool === "agency_list_publications") return { items: stored.publications } as never;
    if (tool === "agency_list_issues") return { items: stored.issues } as never;
    if (tool === "agency_publish_agency") {
      const frozen = await stored.published();
      stored.publications = [...stored.publications, frozen];
      return frozen as never;
    }
    throw new Error("unexpected " + tool);
  });
};

const toolsAsked = (tool: string) => asked.filter((call) => call.tool === tool);

afterEach(() => {
  vi.mocked(callTool).mockReset();
});

const open = (hubId = "h1", page = "goals", refresh = 0) =>
  renderHook((props: { hubId: string; page: string; refresh: number }) => useDraft(props.hubId, props.page, props.refresh), {
    initialProps: { hubId, page, refresh },
  });

const settled = async (result: { current: { changes: unknown[] } }, count: number) => {
  await waitFor(() => expect(result.current.changes).toHaveLength(count));
};

describe("the draft state of the open hub", () => {
  it("asks the backend nothing on a page that has no draft bar and stays at none", async () => {
    startBackend({ approvals: [goalApproval("a1")] });
    const { result } = open("h1", "groups");
    await act(async () => {});
    expect(asked).toEqual([]);
    expect(result.current.state).toBe("none");
    expect(result.current.changes).toEqual([]);
  });

  it("is none while no approved change waits to be published", async () => {
    startBackend();
    const { result } = open();
    await waitFor(() => expect(toolsAsked("agency_list_publications")).toHaveLength(1));
    expect(result.current.state).toBe("none");
  });

  it("is not ready until the first answer of the backend arrives, then is ready", async () => {
    startBackend({ approvals: [goalApproval("a1")] });
    const { result } = open();
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it("is never ready on a page that has no draft bar", async () => {
    startBackend();
    const { result } = open("h1", "status");
    await act(async () => {});
    expect(result.current.ready).toBe(false);
  });

  it("is pending with the changes listed when approved changes wait to be published", async () => {
    startBackend({ approvals: [goalApproval("a2"), goalApproval("a1")] });
    const { result } = open();
    await settled(result, 2);
    expect(result.current.state).toBe("pending");
    expect(result.current.changes.map((change) => change.id)).toEqual(["a2", "a1"]);
    expect(result.current.version).toBeNull();
    expect(result.current.problems).toEqual([]);
  });

  it("is none when everything approved was published already", async () => {
    startBackend({
      approvals: [goalApproval("a1", "2026-10-27T08:00:00Z")],
      publications: [{ version: 1, tag: "v1", published_at: "2026-10-27T09:00:00Z" }],
    });
    const { result } = open();
    await waitFor(() => expect(toolsAsked("agency_list_publications")).toHaveLength(1));
    expect(result.current.state).toBe("none");
  });

  it("stays none when the backend cannot be read, so no bar is drawn from a guess", async () => {
    startBackend({ unreadable: true, approvals: [goalApproval("a1")] });
    const { result } = open();
    await waitFor(() => expect(toolsAsked("agency_list_drafts")).toHaveLength(1));
    expect(result.current.state).toBe("none");
  });

  it("shows the publishing state while the agency is being checked and published", async () => {
    let finish: (answer: unknown) => void = () => {};
    startBackend({ approvals: [goalApproval("a1")], published: () => new Promise((resolve) => (finish = resolve)) });
    const { result } = open();
    await settled(result, 1);
    act(() => result.current.publish());
    await waitFor(() => expect(result.current.state).toBe("publishing"));
    expect(result.current.changes).toHaveLength(1);
    await act(async () => finish({ version: 4, tag: "v4", published_at: "2026-10-27T11:00:00Z" }));
    await waitFor(() => expect(result.current.state).toBe("published"));
  });

  it("publishes the open draft and then shows the version with no change left waiting", async () => {
    startBackend({
      approvals: [goalApproval("a1")],
      published: async () => ({ version: 4, tag: "v4", channel: "production", published_at: "2026-10-27T11:00:00Z" }),
    });
    const { result } = open();
    await settled(result, 1);
    act(() => result.current.publish());
    await waitFor(() => expect(result.current.state).toBe("published"));
    await waitFor(() => expect(toolsAsked("agency_list_publications")).toHaveLength(2));
    expect(result.current.state).toBe("published");
    expect(result.current.version).toEqual({ version: 4, tag: "v4", at: "2026-10-27T11:00:00Z" });
    expect(result.current.changes).toEqual([]);
    expect(toolsAsked("agency_publish_agency")[0].args).toEqual({ draft_id: "d1", channel: "production" });
  });

  it("does not show the old count again between the publish and the reload", async () => {
    startBackend({ approvals: [goalApproval("a1")] });
    const states: string[] = [];
    const { result } = renderHook(() => {
      const draft = useDraft("h1", "goals", 0);
      states.push(draft.state);
      return draft;
    });
    await settled(result, 1);
    act(() => result.current.publish());
    await waitFor(() => expect(result.current.state).toBe("published"));
    await waitFor(() => expect(toolsAsked("agency_list_publications")).toHaveLength(2));
    expect(states.slice(states.indexOf("publishing"))).not.toContain("pending");
  });

  it("keeps the changes and the bar and lists each problem when the scan refuses", async () => {
    startBackend({
      approvals: [goalApproval("a1"), goalApproval("a2")],
      issues: [{ id: "i1", severity: "error", message: 'Goal G-1 "A" has no Objectives', entity_type: "goal", entity_id: "g1" }],
    });
    const { result } = open();
    await settled(result, 2);
    act(() => result.current.publish());
    await waitFor(() => expect(result.current.state).toBe("failed"));
    expect(result.current.changes).toHaveLength(2);
    expect(result.current.problems).toEqual([{ message: 'Goal G-1 "A" has no Objectives', to: "/h/h1/goals?goal=g1", open: "draft.openGoal" }]);
    expect(toolsAsked("agency_publish_agency")).toHaveLength(0);
  });

  it("publishes on the second try after the problems were fixed", async () => {
    startBackend({
      approvals: [goalApproval("a1")],
      issues: [{ id: "i1", severity: "error", message: "The Agency has no Goals", entity_type: "agency", entity_id: "" }],
    });
    const { result } = open();
    await settled(result, 1);
    act(() => result.current.publish());
    await waitFor(() => expect(result.current.state).toBe("failed"));
    stored.issues = [];
    act(() => result.current.publish());
    await waitFor(() => expect(result.current.state).toBe("published"));
    expect(result.current.problems).toEqual([]);
    expect(toolsAsked("agency_publish_agency")).toHaveLength(1);
  });

  it("keeps the failed bar but with the new count when another change is approved after a refused publish", async () => {
    startBackend({
      approvals: [goalApproval("a1")],
      issues: [{ id: "i1", severity: "error", message: "The Agency has no Goals", entity_type: "agency", entity_id: "" }],
    });
    const { result, rerender } = open();
    await settled(result, 1);
    act(() => result.current.publish());
    await waitFor(() => expect(result.current.state).toBe("failed"));
    stored.approvals = [goalApproval("a2"), goalApproval("a1")];
    rerender({ hubId: "h1", page: "goals", refresh: 1 });
    await settled(result, 2);
    expect(result.current.state).toBe("failed");
    expect(result.current.changes).toHaveLength(2);
  });

  it("asks again when an approval refreshes the menu and shows the new count", async () => {
    startBackend({ approvals: [goalApproval("a1")] });
    const { result, rerender } = open();
    await settled(result, 1);
    stored.approvals = [goalApproval("a2"), goalApproval("a1")];
    rerender({ hubId: "h1", page: "goals", refresh: 1 });
    await settled(result, 2);
    expect(toolsAsked("agency_list_approvals")).toHaveLength(2);
    expect(result.current.state).toBe("pending");
  });

  it("asks again when the manager comes to an agency page from another page", async () => {
    startBackend({ approvals: [goalApproval("a1")] });
    const { result, rerender } = open("h1", "approvals");
    await act(async () => {});
    expect(asked).toEqual([]);
    rerender({ hubId: "h1", page: "roles", refresh: 0 });
    await settled(result, 1);
    expect(toolsAsked("agency_list_drafts")).toHaveLength(1);
  });

  it("shows the changes of the hub the manager switched to and none of the hub left behind", async () => {
    startBackend({ approvals: [goalApproval("a1")] });
    const { result, rerender } = open("h1");
    await settled(result, 1);
    startBackend({ approvals: [] });
    rerender({ hubId: "h2", page: "goals", refresh: 0 });
    await waitFor(() => expect(result.current.changes).toEqual([]));
    expect(result.current.state).toBe("none");
    expect(toolsAsked("agency_list_drafts")[0].hubId).toBe("h2");
  });

  it("does not carry a failed publish over to another hub", async () => {
    startBackend({
      approvals: [goalApproval("a1")],
      issues: [{ id: "i1", severity: "error", message: "The Agency has no Goals", entity_type: "agency", entity_id: "" }],
    });
    const { result, rerender } = open("h1");
    await settled(result, 1);
    act(() => result.current.publish());
    await waitFor(() => expect(result.current.state).toBe("failed"));
    startBackend({ approvals: [goalApproval("b1")] });
    rerender({ hubId: "h2", page: "goals", refresh: 0 });
    await waitFor(() => expect(result.current.state).toBe("pending"));
    expect(result.current.problems).toEqual([]);
  });

  it("ignores a second press while the first publish is still going", async () => {
    let finish: (answer: unknown) => void = () => {};
    startBackend({ approvals: [goalApproval("a1")], published: () => new Promise((resolve) => (finish = resolve)) });
    const { result } = open();
    await settled(result, 1);
    act(() => result.current.publish());
    await waitFor(() => expect(result.current.state).toBe("publishing"));
    act(() => result.current.publish());
    await act(async () => finish({ version: 2, tag: "v2", published_at: "2026-10-27T11:00:00Z" }));
    await waitFor(() => expect(result.current.state).toBe("published"));
    expect(toolsAsked("agency_publish_agency")).toHaveLength(1);
  });

  it("publishes nothing when there is no open draft to publish", async () => {
    startBackend({ drafts: [], approvals: [goalApproval("a1")] });
    const { result } = open();
    await waitFor(() => expect(toolsAsked("agency_list_drafts")).toHaveLength(1));
    act(() => result.current.publish());
    await act(async () => {});
    expect(toolsAsked("agency_publish_agency")).toHaveLength(0);
    expect(result.current.state).toBe("none");
  });
});
