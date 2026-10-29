import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { loadUserDetail } from "./usersDetail";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const replies: Record<string, unknown> = {
  actor_get_actor: { id: "a1", display_name: "Amina Otieno", public_code: "M-AAA-111", created_at: "2026-10-26T09:00:00Z" },
  actor_list_groups_for_actor: { items: [{ actor_id: "a1", group_id: "g1" }, { actor_id: "a1", group_id: "g9" }] },
  actor_list_groups: { items: [{ id: "g1", name: "Siaya farmers" }, { id: "g2", name: "Supplier" }] },
  taskmanager_task_list: {
    items: [
      { id: "t1", title: "Send the seed list", status: "open", due_at: "2026-10-30T09:00:00Z", assigned_to: "a1", assignee_kind: "actor" },
      { id: "t2", title: "Someone else's", status: "open", assigned_to: "a2", assignee_kind: "actor" },
      { id: "t3", title: "An agent's task with the same id", status: "open", assigned_to: "a1", assignee_kind: "agent" },
    ],
  },
  assetmanager_hold_list: {
    items: [
      { id: "h1", quantity: 2, status: "reserved", ends_at: "2026-10-29T12:00:00Z", expires_at: "2026-10-29T10:30:00Z", placed_by: "a1" },
      { id: "h2", quantity: 1, status: "committed", placed_by: "a2" },
      { id: "h3", quantity: "5", status: "released", expires_at: "2026-10-20T10:00:00Z", placed_by: "a1" },
    ],
  },
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockImplementation((async (_hub: string, tool: string) => replies[tool] ?? { items: [] }) as typeof callTool);
});

describe("reading one user", () => {
  it("reads the actor, her groups, the tasks and the holds from the hub's tools", async () => {
    await loadUserDetail("h1", "a1");

    const asked = vi.mocked(callTool).mock.calls.map(([, tool, args]) => [tool, args]);
    expect(asked).toContainEqual(["actor_get_actor", { actor_id: "a1" }]);
    expect(asked).toContainEqual(["actor_list_groups_for_actor", { actor_id: "a1" }]);
    expect(asked).toContainEqual(["taskmanager_task_list", {}]);
    expect(asked).toContainEqual(["assetmanager_hold_list", {}]);
  });

  it("takes the member code and the joined date from the actor", async () => {
    const detail = await loadUserDetail("h1", "a1");

    expect(detail.code).toBe("M-AAA-111");
    expect(detail.joined).toBe("2026-10-26T09:00:00Z");
  });

  it("names her groups and leaves out a group the hub no longer lists", async () => {
    expect((await loadUserDetail("h1", "a1")).groups).toEqual(["Siaya farmers"]);
  });

  it("keeps only the tasks handed to her as a person", async () => {
    expect((await loadUserDetail("h1", "a1")).tasks).toEqual([{ id: "t1", title: "Send the seed list", status: "open", due: "2026-10-30T09:00:00Z" }]);
  });

  it("keeps only the holds she placed, ending at the stated end or else at the expiry", async () => {
    expect((await loadUserDetail("h1", "a1")).holds).toEqual([
      { id: "h1", quantity: "2", status: "reserved", until: "2026-10-29T12:00:00Z" },
      { id: "h3", quantity: "5", status: "released", until: "2026-10-20T10:00:00Z" },
    ]);
  });

  it("answers empty lists for a person with nothing", async () => {
    vi.mocked(callTool).mockImplementation((async () => ({ items: [] })) as typeof callTool);

    expect(await loadUserDetail("h1", "a9")).toEqual({ code: "", joined: "", groups: [], tasks: [], holds: [] });
  });

  it("fails when a tool fails", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("down"));

    await expect(loadUserDetail("h1", "a1")).rejects.toThrow("down");
  });
});
