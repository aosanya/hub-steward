import { beforeEach, expect, test, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { groupsPage } from "./groups";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

type Args = Record<string, unknown>;

const call = vi.mocked(callTool);

const answerWith = (replies: Record<string, unknown>) =>
  call.mockImplementation((async (_hub: string, tool: string) => {
    if (tool in replies) return replies[tool];
    return { id: "ap-1" };
  }) as typeof callTool);

const callsTo = (tool: string) => call.mock.calls.filter(([, name]) => name === tool);

const argsOf = (tool: string): Args => callsTo(tool).at(-1)?.[2] ?? {};

const lab = {
  actor_list_groups: {
    items: [
      { id: "g1", name: "Riders", join_mode: "open", attributes: { ai_role: "r1" } },
      { id: "g2", name: "Customers", join_mode: "confirmed" },
    ],
  },
  actor_home_counts: { g1: 3 },
  agency_list_roles: { items: [{ id: "r1", name: "Dispatcher" }] },
  actor_get_group: { id: "g1", name: "Riders", join_mode: "confirmed" },
  actor_list_actors_for_group: {
    items: [
      { actor_id: "akinyi", group_id: "g1", created_at: "2026-10-26" },
      { actor_id: "brian", group_id: "g1", created_at: "2026-10-22" },
    ],
  },
};

const rowsFor = (query: Record<string, string> = {}) => groupsPage.rows("h", query);

const proposeJoinMode = (values: Record<string, unknown>) => groupsPage.actions!.joinMode("h", values);

const proposal = () => {
  const args = argsOf("agency_propose_write");
  return { kind: args.kind, summary: args.summary, payload: JSON.parse(String(args.payload)) };
};

beforeEach(() => {
  call.mockReset();
  answerWith(lab);
});

test("the Groups page offers Create a group with its tools, including the read-only join mode column", () => {
  expect(groupsPage.spec.id).toBe("groups");
  expect(groupsPage.spec.title).toBe("Groups");
  expect(groupsPage.spec.primary).toBe("Create a group");
  expect(groupsPage.spec.tools).toEqual(
    expect.arrayContaining(["actor_create_group", "actor_set_group_join_mode", "actor_list_groups", "actor_home_counts", "agency_list_roles"]),
  );
  expect(groupsPage.spec.columns).toEqual([
    { key: "group", label: "Group" },
    { key: "members", label: "Members" },
    { key: "join_mode", label: "Join mode" },
    { key: "ai_role", label: "AI role" },
  ]);
});

test("group rows join the member count, the join mode word, the stored join mode and the AI role name", async () => {
  expect(await rowsFor()).toEqual([
    { id: "g1", group: "Riders", members: 3, join_mode: "Open", mode: "open", ai_role: "Dispatcher" },
    { id: "g2", group: "Customers", members: 0, join_mode: "Approval required", mode: "confirmed", ai_role: "" },
  ]);
});

test("the AI role names come from the roles of the newest open draft", async () => {
  answerWith({ ...lab, agency_list_drafts: { items: [{ id: "d1", status: "open" }, { id: "d2", status: "open" }] } });
  await rowsFor();
  expect(argsOf("agency_list_drafts")).toEqual({ status: "open" });
  expect(argsOf("agency_list_roles")).toEqual({ draft_id: "d2" });
});

test("the AI role names come from the published roles, sending no draft id, when no draft is open", async () => {
  answerWith({ ...lab, agency_list_drafts: { items: [{ id: "d0", status: "archived" }] } });
  await rowsFor();
  expect(argsOf("agency_list_roles")).toEqual({});
});

test("the stored join mode of a row is the tool's own value even when the page has no word for it", async () => {
  answerWith({ ...lab, actor_list_groups: { items: [{ id: "g9", name: "Odd", join_mode: "invite-only" }, { id: "g8", name: "None" }] } });
  expect((await rowsFor()).map((row) => row.mode)).toEqual(["invite-only", ""]);
});

test("the group list never writes anything", async () => {
  await rowsFor();
  expect(callsTo("actor_set_group_join_mode")).toEqual([]);
  expect(callsTo("actor_create_group")).toEqual([]);
  expect(callsTo("agency_propose_write")).toEqual([]);
});

test("a group query lists that group's members with the group's name and join mode word", async () => {
  const rows = await rowsFor({ group: "g1" });
  expect(rows).toEqual([
    { group: "Riders", member: "akinyi", joined: "2026-10-26", join_mode: "Approval required" },
    { group: "Riders", member: "brian", joined: "2026-10-22", join_mode: "Approval required" },
  ]);
  expect(argsOf("actor_list_actors_for_group")).toEqual({ group_id: "g1" });
  expect(argsOf("actor_get_group")).toEqual({ group_id: "g1" });
});

test("a group query does not list all the groups", async () => {
  await rowsFor({ group: "g1" });
  expect(callsTo("actor_list_groups")).toEqual([]);
});

test("a join mode the page has no word for is shown as it is stored", async () => {
  answerWith({ ...lab, actor_list_groups: { items: [{ id: "g9", name: "Odd", join_mode: "invite-only" }, { id: "g8", name: "None" }] } });
  const rows = await rowsFor();
  expect(rows.map((row) => row.join_mode)).toEqual(["invite-only", ""]);
});

test("an AI role the roles list does not know is shown by its reference", async () => {
  answerWith({ ...lab, agency_list_roles: { items: [] } });
  const rows = await rowsFor();
  expect(rows[0].ai_role).toBe("r1");
});

test("member counts are read when wrapped in counts or items", async () => {
  answerWith({ ...lab, actor_home_counts: { counts: { g1: 5, g2: 2 } } });
  expect((await rowsFor()).map((row) => row.members)).toEqual([5, 2]);
  answerWith({ ...lab, actor_home_counts: { items: { g2: 4 } } });
  expect((await rowsFor()).map((row) => row.members)).toEqual([0, 4]);
});

test("member counts that cannot be read show zero members", async () => {
  answerWith({ ...lab, actor_home_counts: { items: [] } });
  expect((await rowsFor()).map((row) => row.members)).toEqual([0, 0]);
});

test("a tool answering with a bare list is read like one wrapped in items", async () => {
  answerWith({ ...lab, actor_list_groups: [{ id: "g1", name: "Bare", join_mode: "open" }] });
  expect((await rowsFor()).map((row) => row.group)).toEqual(["Bare"]);
});

test("the rows fail when a tool fails", async () => {
  call.mockImplementation((async (_hub: string, tool: string) => {
    if (tool === "actor_home_counts") throw new McpError("actor_home_counts: down");
    return lab.actor_list_groups;
  }) as typeof callTool);
  await expect(rowsFor()).rejects.toThrow("down");
});

test("changing a group's join mode proposes a pending write and never sets it directly", async () => {
  const result = await proposeJoinMode({ id: "g-1", group_name: "Riders", join_mode: "confirmed" });
  expect(result).toBe("accepted");
  expect(call.mock.calls.map(([, tool]) => tool)).toEqual(["agency_propose_write"]);
  expect(call.mock.calls[0][0]).toBe("h");
  expect(proposal()).toEqual({
    kind: "actor_set_group_join_mode",
    summary: "Make the Riders group approval required",
    payload: { group_id: "g-1", join_mode: "confirmed" },
  });
  expect(callsTo("actor_set_group_join_mode")).toEqual([]);
});

test("opening a group to anyone is worded as open to anyone", async () => {
  await proposeJoinMode({ id: " g-1 ", group_name: " Riders ", join_mode: " open " });
  expect(proposal()).toEqual({
    kind: "actor_set_group_join_mode",
    summary: "Make the Riders group open to anyone",
    payload: { group_id: "g-1", join_mode: "open" },
  });
});

test("a join mode proposal without a group name names the group by its id", async () => {
  await proposeJoinMode({ id: "g-1", join_mode: "open" });
  expect(proposal().summary).toBe("Make the g-1 group open to anyone");
});

test("a join mode other than open or confirmed is refused without calling any tool", async () => {
  await expect(proposeJoinMode({ id: "g-1", join_mode: "closed" })).rejects.toThrow("join mode must be open or confirmed");
  await expect(proposeJoinMode({ id: "g-1" })).rejects.toThrow("join mode must be open or confirmed");
  await expect(proposeJoinMode({ id: "g-1", join_mode: "constructor" })).rejects.toThrow("join mode must be open or confirmed");
  expect(call).not.toHaveBeenCalled();
});

test("a join mode proposal without a group is refused without calling any tool", async () => {
  await expect(proposeJoinMode({ id: "  ", join_mode: "open" })).rejects.toThrow("group is required");
  await expect(proposeJoinMode({ join_mode: "open" })).rejects.toThrow("group is required");
  expect(call).not.toHaveBeenCalled();
});

test("a join mode proposal whose tool fails reports the failure", async () => {
  call.mockImplementation((async () => {
    throw new McpError("agency_propose_write: boom");
  }) as typeof callTool);
  await expect(proposeJoinMode({ id: "g-1", join_mode: "open" })).rejects.toThrow("boom");
});

const createGroup = (values: Record<string, unknown>) => groupsPage.actions!.create("h", values);

test("creating a group proposes a pending write and never creates it directly", async () => {
  const result = await createGroup({ name: "  Riders " });
  expect(result).toBe("accepted");
  expect(call.mock.calls.map(([, tool]) => tool)).toEqual(["agency_propose_write"]);
  expect(call.mock.calls[0][0]).toBe("h");
  expect(proposal()).toEqual({ kind: "actor_create_group", summary: "Create the group Riders", payload: { name: "Riders" } });
  expect(callsTo("actor_create_group")).toEqual([]);
});

test("creating a group without a name is refused without calling any tool", async () => {
  await expect(createGroup({ name: "   " })).rejects.toThrow("name is required");
  await expect(createGroup({})).rejects.toThrow("name is required");
  expect(call).not.toHaveBeenCalled();
});

test("creating a group whose tool fails reports the failure", async () => {
  call.mockImplementation((async () => {
    throw new McpError("agency_propose_write: boom");
  }) as typeof callTool);
  await expect(createGroup({ name: "Riders" })).rejects.toThrow("boom");
});

test("creating a group with a name that is not text is not understood and calls nothing", async () => {
  await expect(createGroup({ name: 4 })).rejects.toThrow("that was not understood");
  expect(call).not.toHaveBeenCalled();
});

test("a join mode proposal with a value that is not text is not understood and calls nothing", async () => {
  await expect(proposeJoinMode({ id: "g-1", join_mode: 1 })).rejects.toThrow("that was not understood");
  expect(call).not.toHaveBeenCalled();
});

test("a card query reads the one group by its id and keeps its stored join mode", async () => {
  expect(await rowsFor({ card: "g1" })).toEqual([{ id: "g1", group: "Riders", join_mode: "Approval required", mode: "confirmed" }]);
  expect(argsOf("actor_get_group")).toEqual({ group_id: "g1" });
  expect(callsTo("actor_list_groups")).toHaveLength(0);
  expect(callsTo("actor_list_actors_for_group")).toHaveLength(0);
});

test("a card query fails when the group tool fails", async () => {
  call.mockImplementation((async () => {
    throw new McpError("actor_get_group: down");
  }) as typeof callTool);
  await expect(rowsFor({ card: "g1" })).rejects.toThrow("down");
});
