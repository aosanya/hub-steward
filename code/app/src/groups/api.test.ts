import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../wakala/mcp";
import { groupTools, mcpGroupsClient } from "./api";

vi.mock("../wakala/mcp", () => ({ callTool: vi.fn() }));

const lastTool = () => vi.mocked(callTool).mock.calls.at(-1)?.[1];

const actorGroup = (over: Record<string, unknown> = {}) => ({
  id: "g1",
  code: "G-1",
  public_code: "G-S7F-4KM-2RX",
  hierarchy_id: "h1",
  level_id: "l1",
  name: "Siaya farmers",
  discoverable: true,
  join_mode: "confirmed",
  hidden: false,
  created_at: "2026-10-01T08:00:00Z",
  last_updated: "2026-10-01T08:00:00Z",
  deleted: false,
  ...over,
});

describe("the groups a member is in", () => {
  beforeEach(() => vi.mocked(callTool).mockReset());

  it("reads actor_list_my_groups and keeps each group's id and name", async () => {
    vi.mocked(callTool).mockResolvedValue({ items: [{ id: "g1", name: "Siaya farmers" }, { name: "no id" }] });
    expect(await mcpGroupsClient().listMyGroups()).toEqual([{ id: "g1", name: "Siaya farmers" }]);
    expect(lastTool()).toBe("actor_list_my_groups");
  });
});

describe("the groups client calls the actor tools by their real names", () => {
  beforeEach(() => vi.mocked(callTool).mockReset());

  it("names every tool with the actor_ prefix", () => {
    expect(groupTools).toEqual({
      listJoinable: "actor_list_joinable_groups",
      findByCode: "actor_find_group_by_code",
      join: "actor_join_group",
      listMyRequests: "actor_list_my_join_requests",
      listMine: "actor_list_my_groups",
    });
  });

  it("lists joinable groups under actor_list_joinable_groups", async () => {
    vi.mocked(callTool).mockResolvedValue({ items: [actorGroup()] });
    expect(await mcpGroupsClient().listJoinableGroups()).toHaveLength(1);
    expect(lastTool()).toBe("actor_list_joinable_groups");
  });

  it("finds a group under actor_find_group_by_code with the code", async () => {
    vi.mocked(callTool).mockResolvedValue({ group: actorGroup(), join_mode: "confirmed", state: "none" });
    expect((await mcpGroupsClient().findGroupByCode("G-S7F-4KM-2RX"))?.id).toBe("g1");
    expect(vi.mocked(callTool).mock.calls.at(-1)).toEqual(["", "actor_find_group_by_code", { code: "G-S7F-4KM-2RX" }]);
  });

  it("joins under actor_join_group with the group id", async () => {
    vi.mocked(callTool).mockResolvedValue({ status: "requested", request: { group_id: "g1", state: "pending" } });
    await mcpGroupsClient().joinGroup("g1");
    expect(vi.mocked(callTool).mock.calls.at(-1)).toEqual(["", "actor_join_group", { group_id: "g1" }]);
  });

  it("lists join requests under actor_list_my_join_requests", async () => {
    vi.mocked(callTool).mockResolvedValue({ items: [] });
    await mcpGroupsClient().listMyJoinRequests();
    expect(lastTool()).toBe("actor_list_my_join_requests");
  });
});

describe("a group's join mode and public code", () => {
  beforeEach(() => vi.mocked(callTool).mockReset());

  it("shows the public code, never the internal G-<n>, and needs approval for a confirmed group", async () => {
    vi.mocked(callTool).mockResolvedValue({ items: [actorGroup()] });
    expect(await mcpGroupsClient().listJoinableGroups()).toEqual([
      { id: "g1", name: "Siaya farmers", code: "G-S7F-4KM-2RX", approvalNeeded: true },
    ]);
  });

  it("does not need approval for an open group", async () => {
    vi.mocked(callTool).mockResolvedValue({ items: [actorGroup({ id: "g2", name: "Choir", join_mode: "open", public_code: "G-K7P-4QX-M2T" })] });
    expect(await mcpGroupsClient().listJoinableGroups()).toEqual([
      { id: "g2", name: "Choir", code: "G-K7P-4QX-M2T", approvalNeeded: false },
    ]);
  });

  it("reads the same fields from the group a code finds", async () => {
    vi.mocked(callTool).mockResolvedValue({
      group: actorGroup({ join_mode: "open" }),
      join_mode: "open",
      state: "none",
    });
    expect(await mcpGroupsClient().findGroupByCode("G-S7F-4KM-2RX")).toEqual({
      id: "g1",
      name: "Siaya farmers",
      code: "G-S7F-4KM-2RX",
      approvalNeeded: false,
    });
  });

  it("asks for approval when the group carries no join mode, as actor's default is confirmed", async () => {
    vi.mocked(callTool).mockResolvedValue({ items: [actorGroup({ join_mode: undefined })] });
    expect((await mcpGroupsClient().listJoinableGroups())[0].approvalNeeded).toBe(true);
  });
});

describe("a join request's state", () => {
  beforeEach(() => vi.mocked(callTool).mockReset());

  it("reads state, not status, from each request", async () => {
    vi.mocked(callTool).mockResolvedValue({
      items: [
        { group_id: "g1", state: "pending" },
        { group_id: "g2", state: "approved" },
        { group_id: "g3", state: "declined" },
      ],
    });
    expect(await mcpGroupsClient().listMyJoinRequests()).toEqual([
      { groupId: "g1", state: "pending" },
      { groupId: "g2", state: "approved" },
      { groupId: "g3", state: "declined" },
    ]);
  });

  it("reads the state of the request inside a join reply", async () => {
    vi.mocked(callTool).mockResolvedValue({ status: "requested", request: { group_id: "g1", state: "pending" } });
    expect(await mcpGroupsClient().joinGroup("g1")).toEqual({ groupId: "g1", state: "pending" });
  });

  it("reads a joined reply from an open group as joined", async () => {
    vi.mocked(callTool).mockResolvedValue({ status: "joined", assignment: { group_id: "g1", actor_id: "m1" } });
    expect(await mcpGroupsClient().joinGroup("g1")).toEqual({ groupId: "g1", state: "joined" });
  });

  it("reads an already-a-member reply as joined", async () => {
    vi.mocked(callTool).mockResolvedValue({ status: "member", assignment: { group_id: "g1", actor_id: "m1" } });
    expect(await mcpGroupsClient().joinGroup("g1")).toEqual({ groupId: "g1", state: "joined" });
  });
});
