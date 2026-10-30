import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { App } from "../App";
import { mcpGroupsClient } from "../groups/api";
import * as mcp from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";
import { openAgency } from "../agency/open";
import { agenciesFrom, answerWakala } from "./answerWakala";

beforeEach(() => openAgency("walk-agency"));

const ME = "m1";

const joinPath = "/a/walk-agency/join";

type Raw = Record<string, any>;

type GroupTools = {
  listJoinable: string;
  findByCode: string;
  join: string;
  listRequests: string;
  listMine: string;
};

const groupToolNames = async (): Promise<GroupTools> => {
  let last = "";
  const spy = vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string) => {
    last = tool;
    return {};
  }) as any);
  const client = mcpGroupsClient();
  const nameOf = async (call: () => Promise<unknown>) => {
    await call();
    return last;
  };
  const names: GroupTools = {
    listJoinable: await nameOf(() => client.listJoinableGroups()),
    findByCode: await nameOf(() => client.findGroupByCode("probe")),
    join: await nameOf(() => client.joinGroup("probe")),
    listRequests: await nameOf(() => client.listMyJoinRequests()),
    listMine: await nameOf(() => client.listMyGroups()),
  };
  spy.mockRestore();
  return names;
};

const farmers = { id: "g1", name: "Siaya farmers", code: "G-1", public_code: "G-S7F-4KM-2RX", join_mode: "confirmed" };
const supplier = { id: "g2", name: "Supplier", code: "G-2", public_code: "G-U3P-8TY-5NW", join_mode: "confirmed" };

const freshWorld = (tools: GroupTools) => {
  const store = {
    groups: [farmers, supplier] as Raw[],
    requests: [] as Raw[],
    mine: [] as Raw[],
    invitations: [{ id: "i1", group_name: "Supplier", inviter_name: "Grace Adhiambo", expires_in_days: 5 }] as Raw[],
    calls: [] as Array<[string, Raw]>,
  };

  const firstValue = (args: Raw) => String(Object.values(args)[0] ?? "");

  const handlers: Record<string, (args: Raw) => any> = {
    [tools.listJoinable]: () => ({ items: store.groups }),
    [tools.findByCode]: (args) => ({ items: store.groups.filter((g) => g.public_code === firstValue(args)) }),
    [tools.join]: (args) => {
      const request = { group_id: firstValue(args), state: "pending" };
      store.requests.push(request);
      return request;
    },
    [tools.listRequests]: () => ({ items: store.requests }),
    [tools.listMine]: () => ({ items: store.mine }),
    actor_list_my_groups: () => ({ items: store.mine }),
    comm_chat_thread_list: () => ({
      items: [{ id: "t1", label: "General", audience: "group", requested_by: "", unread: 0, last_message_at: "" }],
    }),
    comm_chat_message_list: () => ({ items: [] }),
    comm_notification_list: () => ({ items: [] }),
    comm_notification_mark_read: () => ({ marked: 0 }),
    actor_list_my_invitations: () => ({ items: store.invitations }),
    actor_accept_invitation: (args) => {
      store.invitations = store.invitations.filter((i) => i.id !== args.invitation_id);
      store.mine.push({ id: "g2", name: "Supplier" });
      return {};
    },
    actor_decline_invitation: (args) => {
      store.invitations = store.invitations.filter((i) => i.id !== args.invitation_id);
      return {};
    },
    market_list_asks: () => ({ items: [] }),
    market_list_posters: () => ({ items: [] }),
    agency_list_drafts: () => ({ items: [] }),
  };

  const approve = (groupId: string) => {
    const group = store.groups.find((g) => g.id === groupId)!;
    store.requests = store.requests.filter((r) => r.group_id !== groupId);
    store.mine.push({ id: group.id, name: group.name });
  };

  const call = async (_hub: string, tool: string, args: Raw = {}) => {
    store.calls.push([tool, args]);
    const handler = handlers[tool];
    if (!handler) throw new Error(`no fake for ${tool}`);
    return structuredClone(handler(args));
  };

  const called = (tool: string) => store.calls.filter(([name]) => name === tool).map(([, args]) => args);

  return { store, approve, call, called };
};

type World = ReturnType<typeof freshWorld>;

const Where = () => <output data-testid="where">{useLocation().pathname}</output>;

const open = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Where />
    </MemoryRouter>,
  );

const where = () => screen.getByTestId("where").textContent ?? "";

const press = (name: string | RegExp) => userEvent.click(screen.getByRole("button", { name }));

const pressWhenShown = async (name: string | RegExp) => userEvent.click(await screen.findByRole("button", { name }));

const heading = (name: string) => screen.findByRole("heading", { name, level: 1 });

let tools: GroupTools;
let world: World;

beforeAll(async () => {
  tools = await groupToolNames();
});

beforeEach(() => {
  world = freshWorld(tools);
  forgetSubject();
  vi.stubGlobal("fetch", answerWakala(() => ME, agenciesFrom(world.call as any)));
  vi.spyOn(mcp, "callTool").mockImplementation(world.call as any);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  forgetSubject();
});

describe("journey 22, step 1: asks to join a group", () => {
  it("opens Join a group from Chat and lists the groups the agency offers with their codes and Ask to join", async () => {
    open("/chat");
    await pressWhenShown("Join a group");

    await heading("Join a group");
    expect(where()).toBe(joinPath);
    expect(await screen.findByText("Siaya farmers")).toBeInTheDocument();
    expect(screen.getByText(/G-S7F-4KM-2RX/)).toBeInTheDocument();
    expect(screen.getByText("Supplier")).toBeInTheDocument();
    expect(screen.getByText(/G-U3P-8TY-5NW/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Ask to join" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Find" })).toBeDisabled();
  });

  it("finds a group by its code and asks to join it", async () => {
    world.store.groups = [farmers];
    open(joinPath);
    await screen.findByText("Siaya farmers");
    await userEvent.type(screen.getByLabelText("Have a group code?"), "G-S7F-4KM-2RX");
    await press("Find");

    expect(await screen.findAllByText("Siaya farmers")).toHaveLength(2);
    expect(world.called(tools.findByCode)).toHaveLength(1);
    expect(Object.values(world.called(tools.findByCode)[0])).toContain("G-S7F-4KM-2RX");

    await userEvent.click(screen.getAllByRole("button", { name: "Ask to join" })[0]);
    expect(await screen.findAllByRole("button", { name: "Requested" })).not.toHaveLength(0);
    expect(world.called(tools.join)).toHaveLength(1);
    expect(Object.values(world.called(tools.join)[0])).toContain("g1");
  });

  it("says so when no group has the code", async () => {
    open(joinPath);
    await screen.findByText("Siaya farmers");
    await userEvent.type(screen.getByLabelText("Have a group code?"), "G-NOPE");
    await press("Find");

    expect(await screen.findByText("No group has that code")).toBeInTheDocument();
    expect(world.called(tools.join)).toHaveLength(0);
  });

  it("shows an empty card when the agency offers no group", async () => {
    world.store.groups = [];
    open(joinPath);
    expect(await screen.findByText("No groups are open to join yet.")).toBeInTheDocument();
  });
});

describe("journey 22, step 2: waits for the coordinator", () => {
  it("marks the group Requested with no countdown, offers Go to Chat, and still reads Requested when she comes back", async () => {
    open(joinPath);
    await userEvent.click((await screen.findAllByRole("button", { name: "Ask to join" }))[0]);

    const requested = await screen.findByRole("button", { name: "Requested" });
    expect(requested).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Ask to join" })).toHaveLength(1);
    expect(screen.queryByText(/\d+\s*(s|sec|min|hour)/i)).toBeNull();
    expect(screen.queryByText(/You are in/)).toBeNull();

    await press("Go to Chat");
    await waitFor(() => expect(where()).toBe("/a/walk-agency/chat"));
    expect(await screen.findByText("No rooms yet.")).toBeInTheDocument();
  });

  it("reads Requested on a later visit while the coordinator has not decided", async () => {
    world.store.requests = [{ group_id: "g1", state: "pending" }];
    open(joinPath);

    expect(await screen.findByRole("button", { name: "Requested" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Ask to join" })).toHaveLength(1);
    expect(world.called(tools.join)).toHaveLength(0);
  });
});

describe("journey 22, step 3: is let in", () => {
  it("says she is in once the coordinator approves, with no Requested row, and opens the group's room", async () => {
    const earlier = open(joinPath);
    await userEvent.click((await screen.findAllByRole("button", { name: "Ask to join" }))[0]);
    await screen.findByRole("button", { name: "Requested" });
    world.approve("g1");
    earlier.unmount();

    open(joinPath);
    expect(await screen.findByText("You are in")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Requested" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Ask to join" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Go to Chat" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Siaya farmers/ }));
    await heading("Threads");
    expect(where()).toBe("/a/walk-agency/chat/g1/threads");
    expect(await screen.findByText("General")).toBeInTheDocument();
  });
});

describe("journey 22, step 4: is invited from the Inbox", () => {
  it("lists the invitation, opens it with who invited her and how long it has left, and joins", async () => {
    open("/inbox");
    await pressWhenShown(/You are invited to Supplier/);

    await heading("Invitation");
    expect(screen.getByText(/Grace Adhiambo invited you to Supplier/)).toBeInTheDocument();
    expect(screen.getByText("Expires in 5 days.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();

    await press("Join");
    expect(await screen.findByText("You joined. The group's room is on Chat.")).toBeInTheDocument();
    expect(world.called("actor_accept_invitation")).toEqual([{ invitation_id: "i1" }]);
    expect(screen.queryByRole("button", { name: "Join" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Decline" })).toBeNull();
  });

  it("declines the invitation and finds the Inbox without it", async () => {
    open("/inbox");
    await pressWhenShown(/You are invited to Supplier/);
    await heading("Invitation");
    await press("Decline");

    await heading("Inbox");
    expect(screen.queryByText(/You are invited to Supplier/)).toBeNull();
    expect(world.called("actor_decline_invitation")).toEqual([{ invitation_id: "i1" }]);
    expect(world.called("actor_accept_invitation")).toHaveLength(0);
  });
});
