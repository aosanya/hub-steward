import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import * as mcp from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";
import { openAgency } from "../agency/open";
import { agenciesFrom, answerWakala } from "./answerWakala";

beforeEach(() => openAgency("walk-agency"));

const ME = "m1";

type Raw = Record<string, any>;

const todayAt = (hours: number, minutes: number) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

const notification = (over: Raw) => ({
  id: "n1",
  event: "joined",
  subject_kind: "group",
  subject_id: "g1",
  names: {},
  created_at: "2026-10-28T10:40:00Z",
  read_at: null as string | null,
  ...over,
});

const freshWorld = () => ({
  notifications: [] as Raw[],
  groups: [] as Raw[],
  threads: {} as Record<string, Raw[]>,
  calls: [] as Array<[string, Raw]>,
});

type World = ReturnType<typeof freshWorld>;

const reply = (world: World) => async (_hub: string, tool: string, args: Raw = {}): Promise<any> => {
  world.calls.push([tool, args]);
  switch (tool) {
    case "comm_notification_list":
      return { items: world.notifications };
    case "comm_notification_mark_read": {
      const ids: string[] = args.ids ?? [];
      world.notifications.forEach((n) => {
        if (ids.includes(n.id)) n.read_at = "2026-10-30T09:00:00Z";
      });
      return { marked: ids.length };
    }
    case "actor_list_my_invitations":
      return { items: [] };
    case "actor_list_my_groups":
      return { items: world.groups };
    case "comm_chat_thread_list":
      return { items: world.threads[args.structure_id] ?? [] };
    case "agency_list_drafts":
    case "agency_list_work_items":
      return { items: [] };
    default:
      throw new Error(`no such tool in this walk: ${tool}`);
  }
};

const open = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

const callsTo = (world: World, tool: string) => world.calls.filter(([name]) => name === tool).map(([, args]) => args);

const dots = () => screen.queryAllByRole("img", { name: "Unread" });

let world: World;

beforeEach(() => {
  world = freshWorld();
  forgetSubject();
  vi.stubGlobal("fetch", answerWakala(() => ME, agenciesFrom(reply(world) as any)));
  vi.spyOn(mcp, "callTool").mockImplementation(reply(world) as any);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("journey 23, step 1: opens the Inbox", () => {
  const seedFarmers = () => {
    world.notifications.push(
      notification({ id: "n1", event: "joined", names: { group: "Siaya Farmers' Group" }, created_at: "2026-10-28T10:40:00Z" }),
      notification({ id: "n2", event: "new_form", subject_kind: "form", created_at: "2026-10-27T08:15:00Z" }),
      notification({ id: "n3", event: "supplier_approved", subject_kind: "poster", created_at: "2026-10-26T07:00:00Z", read_at: "2026-10-26T09:00:00Z" }),
    );
  };

  it("lists what reached her, each row worded, with a dot on the unread ones only", async () => {
    seedFarmers();
    open("/inbox");

    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(await screen.findByText("You joined Siaya Farmers' Group")).toBeInTheDocument();
    expect(screen.getByText("New form")).toBeInTheDocument();
    expect(screen.getByText("You are approved as a supplier")).toBeInTheDocument();
    expect(dots()).toHaveLength(2);
    expect(screen.queryByText("You are all caught up")).not.toBeInTheDocument();
  });

  it("carries the number of unread on the Inbox tab, read once with the list", async () => {
    seedFarmers();
    open("/inbox");

    expect(await screen.findByLabelText("2 unread notifications")).toHaveTextContent("2");
    expect(screen.getByRole("link", { name: /Home/ })).toContainElement(screen.getByLabelText("2 unread notifications"));
    expect(callsTo(world, "comm_notification_list")).toHaveLength(1);
  });

  it("takes the number off the Inbox tab when she marks all read", async () => {
    seedFarmers();
    open("/inbox");
    await userEvent.click(await screen.findByRole("button", { name: "Mark all read" }));

    expect(screen.queryByLabelText(/unread notifications/)).not.toBeInTheDocument();
  });

  it("offers Mark all read while anything is unread", async () => {
    seedFarmers();
    open("/inbox");
    expect(await screen.findByRole("button", { name: "Mark all read" })).toBeInTheDocument();
  });

  it("marks only the unread rows read, clears every dot, keeps the rows and takes Mark all read away", async () => {
    seedFarmers();
    open("/inbox");
    await userEvent.click(await screen.findByRole("button", { name: "Mark all read" }));

    expect(callsTo(world, "comm_notification_mark_read")).toEqual([{ ids: ["n1", "n2"] }]);
    expect(dots()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Mark all read" })).not.toBeInTheDocument();
    expect(screen.getByText("You joined Siaya Farmers' Group")).toBeInTheDocument();
    expect(screen.getByText("New form")).toBeInTheDocument();
    expect(screen.getByText("You are approved as a supplier")).toBeInTheDocument();
  });

  it("shows the rows read when she comes back to the Inbox", async () => {
    seedFarmers();
    const first = open("/inbox");
    await userEvent.click(await screen.findByRole("button", { name: "Mark all read" }));
    first.unmount();

    open("/inbox");
    expect(await screen.findByText("You joined Siaya Farmers' Group")).toBeInTheDocument();
    expect(dots()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Mark all read" })).not.toBeInTheDocument();
  });

  it("does not offer Mark all read when every row is already read", async () => {
    world.notifications.push(notification({ id: "n3", event: "supplier_approved", subject_kind: "poster", read_at: "2026-10-26T09:00:00Z" }));
    open("/inbox");
    expect(await screen.findByText("You are approved as a supplier")).toBeInTheDocument();
    expect(dots()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Mark all read" })).not.toBeInTheDocument();
  });
});

describe("journey 23, step 2: sees nothing new", () => {
  it("shows one card that says she is caught up, with no dot and no Mark all read", async () => {
    open("/inbox");

    expect(await screen.findByText("You are all caught up")).toBeInTheDocument();
    expect(screen.getByText("Notifications from your groups will appear here.")).toBeInTheDocument();
    expect(dots()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Mark all read" })).not.toBeInTheDocument();
    expect(within(document.querySelector("main.body") as HTMLElement).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("journey 23, step 3: reads an ask nobody answered", () => {
  const seedClosedAsk = () =>
    world.notifications.push(
      notification({ id: "c1", event: "ask_closed", subject_kind: "ask", subject_id: "a1", names: { line: "a ride" }, created_at: "2026-10-30T11:35:00Z" }),
    );

  it("words the row Nobody answered with the ask's own line, unread, and never shows the raw event name", async () => {
    seedClosedAsk();
    open("/inbox");

    expect(await screen.findByText("Nobody answered")).toBeInTheDocument();
    expect(screen.getByText("Your ask for a ride closed.")).toBeInTheDocument();
    expect(dots()).toHaveLength(1);
    expect(screen.queryByText("ask_closed")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeInTheDocument();
  });

  it("clears the dot and Mark all read once she has read it, and the row stays", async () => {
    seedClosedAsk();
    open("/inbox");
    await userEvent.click(await screen.findByRole("button", { name: "Mark all read" }));

    expect(callsTo(world, "comm_notification_mark_read")).toEqual([{ ids: ["c1"] }]);
    expect(dots()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Mark all read" })).not.toBeInTheDocument();
    expect(screen.getByText("Nobody answered")).toBeInTheDocument();
    expect(screen.getByText("Your ask for a ride closed.")).toBeInTheDocument();
  });

  it("words a closed ask that carries no line", async () => {
    world.notifications.push(notification({ id: "c2", event: "ask_closed", subject_kind: "ask", names: {} }));
    open("/inbox");
    expect(await screen.findByText("Nobody answered")).toBeInTheDocument();
    expect(screen.getByText("Your ask closed.")).toBeInTheDocument();
  });
});

describe("journey 23, steps 4 and 5: the Chat tab and a busy room", () => {
  const seedRooms = (unread: { farmers: number; suppliers: number; riders: number }) => {
    world.groups.push(
      { id: "g1", name: "Siaya farmers" },
      { id: "g2", name: "Kisumu Agro Supplies" },
      { id: "g3", name: "Siaya Boda Boda Riders" },
    );
    world.threads.g1 = [
      {
        id: "t1",
        structure_id: "g1",
        label: "Farmers",
        unread: unread.farmers,
        last_message_at: todayAt(9, 30),
        last_message: { id: "m1", author_id: "m-grace", author_name: "Grace Adhiambo", body: "I started a group order for urea.", created_at: todayAt(9, 30) },
      },
    ];
    world.threads.g2 = [{ id: "t2", structure_id: "g2", label: "Suppliers", unread: unread.suppliers }];
    world.threads.g3 = [{ id: "t3", structure_id: "g3", label: "Riders", unread: unread.riders }];
  };

  it("step 4: lists her rooms from the Inbox with the latest message, its time and two unread on Asha Otieno's room", async () => {
    seedRooms({ farmers: 2, suppliers: 0, riders: 0 });
    open("/inbox");
    await userEvent.click(await screen.findByRole("link", { name: /Chat/ }));

    expect(await screen.findByRole("heading", { name: "Chat" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Siaya farmers/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kisumu Agro Supplies/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Siaya Boda Boda Riders/ })).toBeInTheDocument();
    expect(screen.getByText("Grace Adhiambo: I started a group order for urea.")).toBeInTheDocument();
    expect(screen.getByText("09:30")).toBeInTheDocument();
    expect(screen.getByLabelText("2 unread")).toHaveTextContent("2");
    expect(screen.getAllByLabelText(/unread$/)).toHaveLength(1);
  });

  it("step 4: draws the three rooms from the group list and one thread list per group, reading no thread", async () => {
    seedRooms({ farmers: 2, suppliers: 0, riders: 0 });
    open("/chat");
    expect(await screen.findByRole("button", { name: /Siaya farmers/ })).toBeInTheDocument();
    expect(callsTo(world, "actor_list_my_groups")).toHaveLength(1);
    expect(callsTo(world, "comm_chat_thread_list")).toHaveLength(3);
    expect(callsTo(world, "comm_chat_message_list")).toHaveLength(0);
  });

  it("step 4: a room with nothing unread carries no count", async () => {
    seedRooms({ farmers: 0, suppliers: 0, riders: 0 });
    open("/chat");
    expect(await screen.findByRole("button", { name: /Siaya farmers/ })).toBeInTheDocument();
    expect(screen.queryAllByLabelText(/unread$/)).toHaveLength(0);
  });

  it("step 5: a room with more than 99 posts unread shows 99+ and the count stops there", async () => {
    seedRooms({ farmers: 2, suppliers: 100, riders: 4800 });
    open("/chat");
    expect(await screen.findByRole("button", { name: /Kisumu Agro Supplies/ })).toBeInTheDocument();

    const busy = screen.getAllByLabelText("99+ unread");
    expect(busy).toHaveLength(2);
    busy.forEach((count) => expect(count).toHaveTextContent("99+"));
    expect(screen.getByLabelText("2 unread")).toBeInTheDocument();
    expect(screen.queryByText("100")).not.toBeInTheDocument();
    expect(screen.queryByText("4800")).not.toBeInTheDocument();
  });

  it("step 5: ninety-nine unread still shows 99, not 99+", async () => {
    seedRooms({ farmers: 99, suppliers: 0, riders: 0 });
    open("/chat");
    expect(await screen.findByLabelText("99 unread")).toHaveTextContent("99");
    expect(screen.queryByLabelText("99+ unread")).not.toBeInTheDocument();
  });
});
