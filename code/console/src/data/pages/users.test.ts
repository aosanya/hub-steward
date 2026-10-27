import { beforeEach, expect, test, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { filterUserRows, usersPage, usersWithWaiting, type SeatRole, type UserRow } from "./users";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

type Args = Record<string, unknown>;

const call = vi.mocked(callTool);

const answer = (reply: (tool: string, args: Args) => unknown) =>
  call.mockImplementation((async (_hub: string, tool: string, args: Args = {}) => reply(tool, args)) as typeof callTool);

const callsTo = (tool: string) => call.mock.calls.filter(([, name]) => name === tool);

const argsOf = (tool: string): Args => callsTo(tool).at(-1)?.[2] ?? {};

const lab = (tool: string, args: Args): unknown => {
  switch (tool) {
    case "actor_list_actors":
      return {
        items: [
          { id: "a1", display_name: "Amara Test", created_at: "2026-10-01T09:00:00Z" },
          { id: "a2", display_name: "Bram Sample", created_at: "2026-10-25T09:00:00Z" },
          { id: "a3", display_name: "Amalia Demo", created_at: "2026-10-26T09:00:00Z" },
        ],
      };
    case "actor_list_actors_for_group":
      return { items: [{ actor_id: "a1", group_id: "g1" }] };
    case "actor_list_role_kinds":
      return {
        items: [
          { id: "k1", name: "Farmer" },
          { id: "k2", name: "Supplier" },
        ],
      };
    case "actor_list_role_holders":
      return args.kind_id === "k1"
        ? { items: [{ actor_id: "a1", kind_id: "k1", display_name: "Amara Test", active: true }] }
        : { items: [{ actor_id: "a3", kind_id: "k2", active: true }] };
    default:
      return { items: [] };
  }
};

const rowsFor = (query: Record<string, string> = {}) => usersPage.rows("h1", query);

const roleNamesOf = (row: Record<string, unknown>) => (row.roles as SeatRole[]).map((seat) => seat.role);

const invite = (values: Record<string, unknown>) => usersPage.actions!.users("h", values);

const proposal = () => {
  const args = argsOf("agency_propose_write");
  return { kind: args.kind, summary: args.summary, payload: JSON.parse(String(args.payload)) };
};

const codeLookup = (reply: unknown) => (tool: string, args: Args) =>
  tool === "actor_get_screen_name_by_code" ? reply : { id: "ap-1", args };

beforeEach(() => {
  call.mockReset();
  answer(lab);
});

test("the Users page offers Invite a user over the user, role, access and joined columns", () => {
  expect(usersPage.spec).toEqual({
    id: "users",
    title: "Users",
    primary: "Invite a user",
    tools: [
      "actor_list_actors",
      "actor_list_groups",
      "actor_list_actors_for_group",
      "actor_list_join_requests_for_group",
      "actor_list_role_kinds",
      "actor_list_role_holders",
      "actor_invite_to_group",
      "actor_get_actor",
      "actor_list_groups_for_actor",
      "taskmanager_task_list",
      "assetmanager_hold_list",
    ],
    columns: [
      { key: "user", label: "User" },
      { key: "role", label: "Role" },
      { key: "access", label: "Access" },
      { key: "joined", label: "Joined" },
    ],
  });
});

test("every user row carries the role they hold, member access and when they joined", async () => {
  const rows = await rowsFor();
  expect(rows).toEqual([
    { id: "a1", member_code: "", user: "Amara Test", groups: [], roles: [{ group: "", role: "Farmer" }], access: "member", joined: "2026-10-01T09:00:00Z" },
    { id: "a2", member_code: "", user: "Bram Sample", groups: [], roles: [], access: "member", joined: "2026-10-25T09:00:00Z" },
    { id: "a3", member_code: "", user: "Amalia Demo", groups: [], roles: [{ group: "", role: "Supplier" }], access: "member", joined: "2026-10-26T09:00:00Z" },
  ]);
});

const withGroups = (tool: string, args: Args) => {
  if (tool === "actor_list_groups") return { items: [{ id: "g1", name: "Riders" }, { id: "g2", name: "Customers" }] };
  if (tool === "actor_list_actors_for_group") return { items: args.group_id === "g1" ? [{ actor_id: "a1" }, { actor_id: "a3" }] : [{ actor_id: "a3" }] };
  return lab(tool, args);
};

test("every user row names the groups the person is in, from the roster of each group", async () => {
  answer(withGroups);
  const rows = await rowsFor();
  expect(rows.map((row) => [row.user, row.groups])).toEqual([
    ["Amara Test", ["Riders"]],
    ["Bram Sample", []],
    ["Amalia Demo", ["Riders", "Customers"]],
  ]);
  expect(callsTo("actor_list_actors_for_group").map(([, , args]) => args)).toEqual([{ group_id: "g1" }, { group_id: "g2" }]);
});

test("a person's member code is carried on the row for people who have one", async () => {
  answer((tool, args) =>
    tool === "actor_list_actors" ? { items: [{ id: "a1", display_name: "Coded", public_code: "M-ZYS-ATE-J57" }] } : lab(tool, args),
  );
  const rows = await rowsFor();
  expect(rows[0].member_code).toBe("M-ZYS-ATE-J57");
});

test("a person without a name keeps an empty user so the page can show the code instead", async () => {
  answer((tool, args) => (tool === "actor_list_actors" ? { items: [{ id: "a1", display_name: "", public_code: "M-1" }] } : lab(tool, args)));
  const rows = await rowsFor();
  expect(rows.map((row) => [row.user, row.member_code])).toEqual([["", "M-1"]]);
});

const listed = (rows: Partial<UserRow>[]): UserRow[] =>
  rows.map((row, index) => ({ id: "p" + index, member_code: "", user: "", groups: [], roles: [], access: "member", joined: "", ...row }));

test("the rows already listed are narrowed by search, role and since with the same rules as the tools' answers", () => {
  const everyone = listed([
    { user: "Amara Test", roles: [{ group: "", role: "Farmer" }], joined: "2026-10-01T09:00:00Z" },
    { user: "Bram Sample", roles: [], joined: "2026-10-25T09:00:00Z" },
    { user: "Amalia Demo", roles: [{ group: "", role: "Supplier" }], joined: "2026-10-26T09:00:00Z" },
  ]);
  expect(filterUserRows(everyone, { search: " AMA " }).map((row) => row.user)).toEqual(["Amara Test", "Amalia Demo"]);
  expect(filterUserRows(everyone, { role: "SUPPLIER" }).map((row) => row.user)).toEqual(["Amalia Demo"]);
  expect(filterUserRows(everyone, { since: "2026-10-25T09:00:00Z" }).map((row) => row.user)).toEqual(["Bram Sample", "Amalia Demo"]);
  expect(filterUserRows(everyone, { since: "last week" })).toHaveLength(3);
  expect(filterUserRows(everyone, {})).toEqual(everyone);
});

test("narrowing the listed rows by since leaves out whoever has no readable joined date", () => {
  const everyone = listed([{ user: "No Date" }, { user: "Odd Date", joined: "yesterday" }]);
  expect(filterUserRows(everyone, { since: "2026-10-20T00:00:00Z" })).toEqual([]);
});

test("the roles of every kind are looked up by kind id among the active holders", async () => {
  await rowsFor();
  const holderCalls = callsTo("actor_list_role_holders").map(([, , args]) => args);
  expect(holderCalls).toEqual([
    { kind_id: "k1", active_only: true },
    { kind_id: "k2", active_only: true },
  ]);
});

test("searching narrows the users by name whatever the case", async () => {
  const rows = await rowsFor({ search: "AMA" });
  expect(rows.map((row) => row.user)).toEqual(["Amara Test", "Amalia Demo"]);
});

test("a search with only spaces shows everyone", async () => {
  expect(await rowsFor({ search: "   " })).toHaveLength(3);
});

test("filtering by role keeps only the people who hold it, whatever the case", async () => {
  const rows = await rowsFor({ role: "farmer" });
  expect(rows.map((row) => row.user)).toEqual(["Amara Test"]);
});

test("filtering by a role nobody holds shows no one", async () => {
  expect(await rowsFor({ role: "treasurer" })).toEqual([]);
});

test("the since filter lists only who joined from that moment on", async () => {
  const rows = await rowsFor({ since: "2026-10-20T00:00:00Z" });
  expect(rows.map((row) => row.user)).toEqual(["Bram Sample", "Amalia Demo"]);
});

test("someone who joined exactly at the since moment is still listed", async () => {
  const rows = await rowsFor({ since: "2026-10-25T09:00:00Z" });
  expect(rows.map((row) => row.user)).toEqual(["Bram Sample", "Amalia Demo"]);
});

test("a since value that is not a full timestamp filters nothing", async () => {
  expect(await rowsFor({ since: "2026-10-20" })).toHaveLength(3);
  expect(await rowsFor({ since: "last week" })).toHaveLength(3);
});

test("with a since filter, someone whose joined date cannot be read is left out", async () => {
  answer((tool, args) =>
    tool === "actor_list_actors"
      ? { items: [{ id: "a1", display_name: "No Date" }, { id: "a2", display_name: "Odd Date", created_at: "yesterday" }] }
      : lab(tool, args),
  );
  expect(await rowsFor({ since: "2026-10-20T00:00:00Z" })).toEqual([]);
  expect(await rowsFor()).toHaveLength(2);
});

test("filtering by group asks the group's roster and lists only its members", async () => {
  const rows = await rowsFor({ group: "g1" });
  expect(argsOf("actor_list_actors_for_group")).toEqual({ group_id: "g1" });
  expect(rows.map((row) => row.user)).toEqual(["Amara Test"]);
  expect(roleNamesOf(rows[0])).toEqual(["Farmer"]);
});

test("without a group filter the roster of a group is never asked", async () => {
  await rowsFor();
  expect(callsTo("actor_list_actors_for_group")).toEqual([]);
});

test("a person is recognised by actor id when they have one, and otherwise by id", async () => {
  answer((tool, args) => {
    if (tool === "actor_list_actors") return { items: [{ id: "row-1", actor_id: "p-1", name: "Plain Name" }, { id: "p-2", display_name: "Second" }] };
    if (tool === "actor_list_actors_for_group") return { items: [{ actor_id: "p-1" }, { actor_id: "p-2" }] };
    if (tool === "actor_list_role_holders") return { items: [{ actor_id: "p-1" }, { id: "p-2" }] };
    return lab(tool, args);
  });
  const rows = await rowsFor({ group: "g1" });
  expect(rows.map((row) => [row.user, roleNamesOf(row).join()])).toEqual([
    ["Plain Name", "Farmer,Supplier"],
    ["Second", "Farmer,Supplier"],
  ]);
});

test("a person who holds two kinds shows both", async () => {
  answer((tool, args) => (tool === "actor_list_role_holders" ? { items: [{ actor_id: "a1" }] } : lab(tool, args)));
  const rows = await rowsFor();
  expect(roleNamesOf(rows[0])).toEqual(["Farmer", "Supplier"]);
});

test("a tool answering with a bare list is read like one wrapped in items", async () => {
  answer((tool, args) => (tool === "actor_list_actors" ? [{ id: "a1", display_name: "Bare" }] : lab(tool, args)));
  const rows = await rowsFor();
  expect(rows.map((row) => row.user)).toEqual(["Bare"]);
});

test("an agency with no people shows no rows", async () => {
  answer(() => ({}));
  expect(await rowsFor()).toEqual([]);
});

test("the rows fail when a tool fails", async () => {
  answer((tool, args) => {
    if (tool === "actor_list_actors") throw new McpError("actor_list_actors: down");
    return lab(tool, args);
  });
  await expect(rowsFor()).rejects.toThrow("down");
});

test("inviting a person by id proposes a pending write with the real arguments and answers accepted", async () => {
  const result = await invite({ group_id: " g-1 ", group_name: "Ward 3", actor_id: " a-9 ", name: "Amina" });
  expect(result).toBe("accepted");
  expect(call.mock.calls.map(([, tool]) => tool)).toEqual(["agency_propose_write"]);
  expect(call.mock.calls[0][0]).toBe("h");
  expect(proposal()).toEqual({
    kind: "actor_invite_to_group",
    summary: "Invite Amina to Ward 3",
    payload: { group_id: "g-1", actor_id: "a-9" },
  });
});

test("an invite without a typed name or group name is summarised by the ids", async () => {
  await invite({ group_id: "g-1", actor_id: "a-9" });
  expect(proposal().summary).toBe("Invite a-9 to g-1");
});

test("an invite never writes the invitation itself", async () => {
  await invite({ group_id: "g-1", actor_id: "a-9" });
  expect(callsTo("actor_invite_to_group")).toEqual([]);
});

test("an invite with no group or no one to invite is refused without calling any tool", async () => {
  await expect(invite({ group_id: "  ", actor_id: "a" })).rejects.toThrow("group is required");
  await expect(invite({ group_id: "g", actor_id: " " })).rejects.toThrow("who to invite is required");
  await expect(invite({ group_id: "g" })).rejects.toThrow("who to invite is required");
  expect(call).not.toHaveBeenCalled();
});

test("an invite whose tool fails reports the failure", async () => {
  answer(() => {
    throw new McpError("agency_propose_write: boom");
  });
  await expect(invite({ group_id: "g", actor_id: "a" })).rejects.toThrow("boom");
});

test("inviting by member code looks up the screen name and proposes the code under that name", async () => {
  answer(codeLookup({ display_name: "Amina K" }));
  const result = await invite({ group_id: "g-1", group_name: "Ward 3", actor_code: " M-K7P-4QX-M2T ", name: "Typed Name" });
  expect(result).toBe("accepted");
  expect(call.mock.calls.map(([, tool]) => tool)).toEqual(["actor_get_screen_name_by_code", "agency_propose_write"]);
  expect(argsOf("actor_get_screen_name_by_code")).toEqual({ code: "M-K7P-4QX-M2T" });
  expect(proposal()).toEqual({
    kind: "actor_invite_to_group",
    summary: "Invite Amina K to Ward 3",
    payload: { group_id: "g-1", actor_code: "M-K7P-4QX-M2T" },
  });
});

test("giving both a member code and a person id is refused before any tool is called", async () => {
  await expect(invite({ group_id: "g", actor_id: "a", actor_code: "M-1" })).rejects.toThrow("give a member code or a person id, not both");
  expect(call).not.toHaveBeenCalled();
});

test("a member code nobody has is refused and nothing is proposed", async () => {
  answer(codeLookup({}));
  await expect(invite({ group_id: "g", actor_code: "M-1" })).rejects.toThrow("no member has that code");
  answer(codeLookup({ display_name: "   " }));
  await expect(invite({ group_id: "g", actor_code: "M-1" })).rejects.toThrow("no member has that code");
  expect(callsTo("agency_propose_write")).toEqual([]);
});

test("a failing code lookup is reported as no member having that code", async () => {
  answer(() => {
    throw new McpError("actor_get_screen_name_by_code: down");
  });
  await expect(invite({ group_id: "g", actor_code: "M-1" })).rejects.toThrow("no member has that code");
  expect(callsTo("agency_propose_write")).toEqual([]);
});

test("a code lookup refused because the person is signed out stays a sign-in failure", async () => {
  answer(() => {
    throw new McpError("not signed in", true);
  });
  const failure = await invite({ group_id: "g", actor_code: "M-1" }).catch((error: McpError) => error);
  expect(failure).toBeInstanceOf(McpError);
  expect((failure as McpError).unauthorized).toBe(true);
});

test("an invite with a value that is not text is not understood and calls nothing", async () => {
  await expect(invite({ group_id: 7, actor_id: "a" })).rejects.toThrow("that was not understood");
  expect(call).not.toHaveBeenCalled();
});

const withRequests = (requests: Record<string, unknown[]>) => (tool: string, args: Args) => {
  if (tool === "actor_list_groups") return { items: [{ id: "g1", name: "Siaya farmers" }, { id: "g2", name: "Suppliers" }] };
  if (tool === "actor_list_join_requests_for_group") return { items: requests[String(args.group_id)] ?? [] };
  return lab(tool, args);
};

test("the people waiting to join are asked of every group, only the ones still waiting", async () => {
  answer(withRequests({}));
  await usersWithWaiting("h1");
  expect(callsTo("actor_list_join_requests_for_group").map(([, , args]) => args)).toEqual([
    { group_id: "g1", pending_only: true },
    { group_id: "g2", pending_only: true },
  ]);
});

test("a person waiting to join is named from the hub's people and carries the group they asked for", async () => {
  answer(withRequests({ g1: [{ id: "r1", actor_id: "a2", group_id: "g1", state: "pending" }] }));
  expect((await usersWithWaiting("h1")).waiting).toEqual([{ id: "r1", actorId: "a2", name: "Bram Sample", group: "Siaya farmers" }]);
});

test("a request that is no longer pending is left out even when the tool returns it", async () => {
  answer(
    withRequests({
      g1: [
        { id: "r1", actor_id: "a2", group_id: "g1", state: "approved" },
        { id: "r2", actor_id: "a3", group_id: "g1", state: "pending" },
      ],
    }),
  );
  expect((await usersWithWaiting("h1")).waiting.map((line) => line.id)).toEqual(["r2"]);
});

test("a person asking for two groups is listed once for each group", async () => {
  answer(
    withRequests({
      g1: [{ id: "r1", actor_id: "a2", group_id: "g1", state: "pending" }],
      g2: [{ id: "r2", actor_id: "a2", group_id: "g2", state: "pending" }],
    }),
  );
  expect((await usersWithWaiting("h1")).waiting.map((line) => [line.name, line.group])).toEqual([
    ["Bram Sample", "Siaya farmers"],
    ["Bram Sample", "Suppliers"],
  ]);
});

test("a person the hub does not list is named by the member code, else by the person id", async () => {
  answer((tool, args) => {
    if (tool === "actor_list_actors") return { items: [{ id: "a9", public_code: "M-AAA-111" }] };
    return withRequests({
      g1: [
        { id: "r1", actor_id: "a9", group_id: "g1", state: "pending" },
        { id: "r2", actor_id: "a7", group_id: "g1", state: "pending" },
      ],
    })(tool, args);
  });
  expect((await usersWithWaiting("h1")).waiting.map((line) => line.name)).toEqual(["M-AAA-111", "a7"]);
});

test("nobody waiting gives an empty list", async () => {
  answer(withRequests({}));
  expect((await usersWithWaiting("h1")).waiting).toEqual([]);
});

test("a failing tool fails the read", async () => {
  call.mockRejectedValue(new Error("down"));
  await expect(usersWithWaiting("h1")).rejects.toThrow("down");
});

test("a failing read of the requests leaves the people listed and nobody waiting", async () => {
  answer((tool, args) => {
    if (tool === "actor_list_join_requests_for_group") throw new Error("down");
    return withRequests({})(tool, args);
  });
  const read = await usersWithWaiting("h1");
  expect(read.waiting).toEqual([]);
  expect(read.rows).toHaveLength(3);
});

test("a failing read of the requests says it failed, so nobody waiting is not told apart from not knowing", async () => {
  answer((tool, args) => {
    if (tool === "actor_list_join_requests_for_group") throw new Error("down");
    return withRequests({})(tool, args);
  });
  expect((await usersWithWaiting("h1")).waitingFailed).toBe(true);
});

test("a read of the requests that worked does not say it failed, with or without anyone waiting", async () => {
  answer(withRequests({ g1: [{ id: "r1", actor_id: "a2", group_id: "g1", state: "pending" }] }));
  expect((await usersWithWaiting("h1")).waitingFailed).toBe(false);
  answer(withRequests({}));
  expect((await usersWithWaiting("h1")).waitingFailed).toBe(false);
});

test("the users page rows alone never ask for join requests", async () => {
  answer(withRequests({}));
  await rowsFor();
  expect(callsTo("actor_list_join_requests_for_group")).toHaveLength(0);
});

test("a failing read of the role holders leaves the people listed with no roles and keeps the role names", async () => {
  answer((tool, args) => {
    if (tool === "actor_list_role_holders") throw new Error("down");
    return withRequests({})(tool, args);
  });
  const read = await usersWithWaiting("h1");
  expect(read.rows).toHaveLength(3);
  expect(read.rows.every((row) => row.roles.length === 0)).toBe(true);
  expect(read.roleNames.length).toBeGreaterThan(0);
});

test("a failing read of the role kinds leaves the people listed with no roles and no role names", async () => {
  answer((tool, args) => {
    if (tool === "actor_list_role_kinds") throw new Error("down");
    return withRequests({})(tool, args);
  });
  const read = await usersWithWaiting("h1");
  expect(read.rows).toHaveLength(3);
  expect(read.roleNames).toEqual([]);
});

const grace = (tool: string, args: Args): unknown => {
  switch (tool) {
    case "actor_list_actors":
      return { items: [{ id: "grace-actor", display_name: "Grace Test" }] };
    case "actor_list_groups":
      return { items: [{ id: "g1", name: "Siaya farmers" }, { id: "g2", name: "Supplier" }] };
    case "actor_list_role_kinds":
      return { items: [{ id: "k1", name: "Coordinator" }, { id: "k2", name: "Member" }] };
    case "actor_list_role_holders":
      return args.kind_id === "k1"
        ? { items: [{ actor_id: "grace-actor", group_id: "g1", kind_id: "k1" }] }
        : { items: [{ actor_id: "grace-actor", group_id: "g2", kind_id: "k2" }, { actor_id: "grace-actor", group_id: "g2", kind_id: "k2" }] };
    case "actor_list_actors_for_group":
      return { items: [{ actor_id: "grace-actor" }] };
    default:
      return { items: [] };
  }
};

test("a person who holds a role in two groups shows each group with the role held there", async () => {
  answer(grace);
  const rows = await rowsFor();
  expect(rows[0].roles).toEqual([
    { group: "Siaya farmers", role: "Coordinator" },
    { group: "Supplier", role: "Member" },
  ]);
});

test("a person who holds a role in one group and none in another shows only the seat held", async () => {
  answer((tool, args) => (tool === "actor_list_role_holders" && args.kind_id === "k2" ? { items: [] } : grace(tool, args)));
  const rows = await rowsFor();
  expect(rows[0].roles).toEqual([{ group: "Siaya farmers", role: "Coordinator" }]);
});

test("the role filter finds a person by any role they hold", async () => {
  answer(grace);
  expect((await rowsFor({ role: "member" })).map((row) => row.user)).toEqual(["Grace Test"]);
  expect((await rowsFor({ role: "coordinator" })).map((row) => row.user)).toEqual(["Grace Test"]);
});

test("every role of the agency is listed, held or not", async () => {
  answer((tool, args) => (tool === "actor_list_role_holders" ? { items: [] } : grace(tool, args)));
  expect((await usersWithWaiting("h1")).roleNames).toEqual(["Coordinator", "Member"]);
});
