import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ChatPage } from "../pages/chat/ChatPage";
import { RoomThreadsPage } from "./rooms/RoomThreadsPage";
import { mcpRoomsClient, type RoomsClient } from "./rooms/api";
import { roomsOf } from "./api";
import { callTool } from "../wakala/mcp";
import { forgetOpenAgency, openAgency } from "../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

vi.mock("../wakala/mcp", () => ({ callTool: vi.fn() }));
vi.mock("../wakala/me", () => ({ loadSubject: vi.fn().mockResolvedValue("u1") }));

const stamp = (hours: number) => {
  const date = new Date();
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
};

const groups = [
  { id: "g1", name: "General" },
  { id: "g2", name: "Dev" },
  { id: "g3", name: "Support" },
  { id: "g4", name: "Archive" },
];

const thread = (id: string, unread: number, hours: number, body: string) => ({
  id,
  label: "General",
  audience: "group",
  unread,
  last_message_at: stamp(hours),
  last_message: { id: `m-${id}`, author_id: "u9", author_name: "Amina", body, created_at: stamp(hours) },
});

const hub = (threadsOf: Record<string, unknown[]>) => {
  const mocked = callTool as any;
  mocked.mockReset();
  mocked.mockImplementation(async (_hub: string, tool: string, args: Record<string, unknown> = {}) => {
    if (tool === "actor_list_my_groups") return { items: groups };
    if (tool === "comm_chat_thread_list") return { items: threadsOf[String(args.structure_id)] ?? [] };
    throw new Error(`${tool} must not be called`);
  });
};

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

const showChat = () =>
  render(
    <MemoryRouter initialEntries={["/chat"]}>
      <Routes>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the Chat tab lists every group the person belongs to, like WhatsApp", () => {
  it("draws a row for each group, newest activity first, and the groups with no messages last by name", async () => {
    hub({ g1: [thread("t1", 0, 8, "Welcome")], g2: [thread("t2", 4, 15, "Standup moved")], g4: [] });
    showChat();
    await screen.findByRole("button", { name: /Dev/ });
    const rows = screen.getAllByRole("button").map((row) => row.textContent ?? "");
    const order = ["Dev", "General", "Archive", "Support"].map((name) => rows.findIndex((text) => text.includes(name)));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("shows the last message, its time and the unread count on a group with messages", async () => {
    hub({ g2: [thread("t2", 4, 15, "Standup moved")] });
    showChat();
    const dev = await screen.findByRole("button", { name: /Dev/ });
    expect(within(dev).getByText("Amina: Standup moved")).toBeInTheDocument();
    expect(within(dev).getByText("15:00")).toBeInTheDocument();
    expect(within(dev).getByLabelText("4 unread")).toBeInTheDocument();
  });

  it("lists a group with no messages yet and says so", async () => {
    hub({});
    showChat();
    const support = await screen.findByRole("button", { name: /Support/ });
    expect(within(support).getByText("No messages yet")).toBeInTheDocument();
    expect(within(support).queryByLabelText(/unread/)).toBeNull();
  });

  it("opens a group that has a thread in its room", async () => {
    hub({ g2: [thread("t2", 0, 15, "Standup moved")] });
    showChat();
    await userEvent.click(await screen.findByRole("button", { name: /Dev/ }));
    expect((await screen.findByTestId("where")).textContent).toBe("/a/farmers/chat/g2/t2");
  });

  it("opens a group with no thread on its empty threads page", async () => {
    hub({});
    showChat();
    await userEvent.click(await screen.findByRole("button", { name: /Support/ }));
    expect((await screen.findByTestId("where")).textContent).toBe("/a/farmers/chat/g3/threads");
  });

  it("asks for the person's groups only, one thread list per group", async () => {
    hub({});
    showChat();
    await screen.findByRole("button", { name: /Support/ });
    const called = (callTool as any).mock.calls.map((c: any[]) => c[1]);
    expect(called.filter((name: string) => name === "actor_list_my_groups")).toHaveLength(1);
    expect(called.filter((name: string) => name === "comm_chat_thread_list")).toHaveLength(groups.length);
  });

  it("keeps the order of the rows for the same moment by group name", () => {
    const rooms = roomsOf([{ id: "b", name: "Beta" }, { id: "a", name: "Alpha" }], [[], []]);
    expect(rooms.map((room) => room.name)).toEqual(["Alpha", "Beta"]);
    expect(rooms.every((room) => room.threadId === "" && room.unread === 0)).toBe(true);
  });
});

describe("the threads page of a group nobody has written in", () => {
  const empty: RoomsClient = {
    ...mcpRoomsClient,
    subject: async () => "u1",
    roomName: async () => "Support",
    listThreads: async () => [],
  };

  it("says No messages yet and offers to start a thread", async () => {
    render(
      <MemoryRouter initialEntries={["/chat/g3/threads"]}>
        <Routes>
          <Route path="/chat/:roomId/threads" element={<RoomThreadsPage client={empty} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("No messages yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a thread" })).toBeInTheDocument();
  });
});
