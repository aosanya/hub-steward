import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { dayWords } from "../../../../shared/ui/days";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { CommunicationsScreen, conversationRows } from "./PeopleScreens";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;

const groups = [
  { id: "g1", name: "Household One" },
  { id: "g3", name: "Reading Circle" },
  { id: "g4", name: "Football Club" },
];

const threadsOf: Record<string, unknown[]> = {
  g1: [{ id: "t3", label: "General", audience: "group", last_message_at: "2026-03-11T12:00:00Z" }],
  g3: [
    { id: "t1", label: "General", audience: "group", last_message_at: "2026-03-12T12:00:00Z" },
    { id: "t2", label: "Garden Helpers", audience: "group", last_message_at: "2026-03-10T12:00:00Z" },
  ],
  g4: [{ id: "t4", label: "General", audience: "group" }],
};

const messagesOf: Record<string, unknown[]> = {
  t1: [
    { id: "m1", author_name: "Amara Kole", body: "Can we start at nine?", created_at: "2026-03-12T08:12:00Z" },
    { id: "m2", author_name: "Dana Reyes", body: "Nine is fine.", created_at: "2026-03-12T08:40:00Z" },
  ],
  t3: [],
};

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let posted: Args[];

beforeEach(() => {
  openAgency("town");
  permissions = ["chat.post"];
  posted = [];
  const answers: Record<string, (args: Args) => unknown> = {
    actor_list_groups: () => ({ items: groups }),
    comm_chat_thread_list: (args) => ({ items: threadsOf[String(args.structure_id)] ?? [] }),
    comm_chat_message_list: (args) => ({ items: messagesOf[String(args.thread_id)] ?? [] }),
    comm_chat_message_post: (args) => {
      posted.push(args);
      messagesOf[String(args.thread_id)] = [...(messagesOf[String(args.thread_id)] ?? []), { id: "m9", author_name: "You", body: args.body, created_at: "2026-03-13T09:00:00Z" }];
      return {};
    },
    agency_get_my_roles: () => ({ permissions }),
  };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const answer = answers[name];
    if (!answer) throw new Error(`${name} is not a tool this screen may use`);
    return answer((args ?? {}) as Args);
  });
  setWide(true);
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

const open = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/residents/communications", state: { from: { path: "/a/town/menu/residents", title: "Register" } } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/residents/communications" element={<CommunicationsScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

describe("the conversation rows", () => {
  it("name the group, put a thread name under it only when it is not General, and run newest first", async () => {
    const rows = await conversationRows();

    expect(rows.map((row) => [row.name, row.line, row.id, row.group_id])).toEqual([
      ["Reading Circle", "", "t1", "g3"],
      ["Household One", "", "t3", "g1"],
      ["Reading Circle", "Garden Helpers", "t2", "g3"],
    ]);
    expect(rows.map((row) => row.last)).toEqual([dayWords("2026-03-12T12:00:00Z"), dayWords("2026-03-11T12:00:00Z"), dayWords("2026-03-10T12:00:00Z")]);
  });

  it("leave out a group whose thread has no message", async () => {
    const rows = await conversationRows();

    expect(rows.some((row) => row.name === "Football Club")).toBe(false);
  });
});

describe("Communications list", () => {
  it("titles each row with the group, tags it with the day of its last message and never shows General as a title", async () => {
    open();

    const list = await screen.findByRole("region", { name: "Communications" }, { timeout: 3000 }).catch(() => document.body);
    expect(await screen.findAllByText("Reading Circle")).not.toHaveLength(0);
    expect(screen.getByText("Household One")).toBeInTheDocument();
    expect(screen.getByText("Garden Helpers")).toBeInTheDocument();
    expect(within(list).queryByText("General")).toBeNull();
    expect(screen.getAllByText(dayWords("2026-03-12T12:00:00Z")).length).toBeGreaterThan(0);
  });
});

describe("a conversation", () => {
  it("is the page title with the group's messages as sender, words and time in a Conversation card", async () => {
    open();

    expect(await screen.findByRole("heading", { level: 1, name: "Reading Circle" })).toBeInTheDocument();
    const card = await screen.findByRole("region", { name: "Conversation" });
    expect(await within(card).findByText("Amara Kole")).toBeInTheDocument();
    expect(within(card).getByText("Can we start at nine?")).toBeInTheDocument();
    expect(within(card).getByText("Dana Reyes")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "comm_chat_message_list", { structure_id: "g3", thread_id: "t1" });
  });

  it("has no header band and no Name table", async () => {
    open();

    await screen.findByRole("heading", { level: 1, name: "Reading Circle" });
    expect(document.querySelector(".wf-head")).toBeNull();
    expect(screen.queryByText("Name")).toBeNull();
  });

  it("writes to the group through the existing post tool and shows the message", async () => {
    open();
    const card = await screen.findByRole("region", { name: "Conversation" });

    await userEvent.click(await within(card).findByRole("button", { name: "Write to the group" }));
    await userEvent.type(await screen.findByRole("textbox"), "See you at nine");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(posted).toEqual([{ structure_id: "g3", thread_id: "t1", body: "See you at nine" }]));
    expect(await within(await screen.findByRole("region", { name: "Conversation" })).findByText("See you at nine")).toBeInTheDocument();
  });

  it("hides Write to the group from someone who may not post", async () => {
    permissions = [];
    open();
    const card = await screen.findByRole("region", { name: "Conversation" });

    await within(card).findByText("Amara Kole");
    expect(within(card).queryByRole("button", { name: "Write to the group" })).toBeNull();
  });

  it("says No messages yet. with the same act when the thread has none", async () => {
    open();
    await screen.findByRole("heading", { level: 1, name: "Reading Circle" });

    await userEvent.click(screen.getByRole("button", { name: /Household One/ }));

    const card = await screen.findByRole("region", { name: "Conversation" });
    expect(await within(card).findByText("No messages yet.")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Write to the group" })).toBeInTheDocument();
  });
});
