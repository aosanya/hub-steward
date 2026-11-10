import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ChatPage } from "../pages/chat/ChatPage";
import { callTool } from "../wakala/mcp";
import { forgetOpenAgency, openAgency } from "../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

vi.mock("../wakala/mcp", async () => ({ ...(await vi.importActual<typeof import("../wakala/mcp")>("../wakala/mcp")), callTool: vi.fn() }));
vi.mock("../wakala/me", () => ({ loadSubject: vi.fn().mockResolvedValue("u1") }));

const today = (hours: number, minutes: number) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

const lastMessage = (author: string, body: string, at: string) => ({ id: `m-${at}`, author_id: "u9", author_name: author, body, created_at: at });

const memberOfTwoGroups = () => {
  const mocked = callTool as any;
  mocked.mockReset();
  mocked.mockImplementation(async (_hub: string, tool: string, args: Record<string, unknown> = {}) => {
    if (tool === "actor_list_my_groups") return { items: [{ id: "g1", name: "Siaya farmers" }, { id: "g2", name: "Suppliers" }] };
    if (tool !== "comm_chat_thread_list") throw new Error(`${tool} must not be read to draw the Chat tab`);
    if (args.structure_id === "g1") {
      return {
        items: [
          { id: "t1", label: "General", audience: "group", unread: 2, last_message_at: today(9, 30), last_message: lastMessage("Baraka Odhiambo", "Count me in.", today(9, 30)) },
          { id: "t2", label: "Urea", audience: "group", unread: 1, last_message_at: today(14, 20), last_message: lastMessage("Farmers' agent", "Do you accept?", today(14, 20)) },
        ],
      };
    }
    return { items: [{ id: "t3", label: "General", audience: "group", unread: 1, last_message_at: today(9, 5), last_message: lastMessage("Suppliers' agent", "Asha Otieno asks: 2 bags of urea.", today(9, 5)) }] };
  });
  return mocked;
};

const show = () =>
  render(
    <MemoryRouter initialEntries={["/chat"]}>
      <Routes>
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the Chat tab of a member of two groups", () => {
  it("draws one row per group with the newest message, its time and the room's unread", async () => {
    memberOfTwoGroups();
    show();
    const farmers = await screen.findByRole("button", { name: /Siaya farmers/ });
    const suppliers = screen.getByRole("button", { name: /Suppliers/ });
    expect(screen.getAllByRole("button", { name: /Siaya farmers|Suppliers/ })).toEqual([farmers, suppliers]);
    expect(within(farmers).getByText("Farmers' agent: Do you accept?")).toBeInTheDocument();
    expect(within(farmers).getByText("14:20")).toBeInTheDocument();
    expect(within(farmers).getByLabelText("3 unread")).toBeInTheDocument();
    expect(within(suppliers).getByText("Suppliers' agent: Asha Otieno asks: 2 bags of urea.")).toBeInTheDocument();
    expect(within(suppliers).getByText("09:05")).toBeInTheDocument();
    expect(within(suppliers).getByLabelText("1 unread")).toBeInTheDocument();
  });

  it("reads the group list and one thread list per group, and no thread at all", async () => {
    const mocked = memberOfTwoGroups();
    show();
    await screen.findByRole("button", { name: /Siaya farmers/ });
    const called = mocked.mock.calls.map((c: any[]) => c[1]);
    const times = (tool: string) => called.filter((name: string) => name === tool).length;
    expect([times("actor_list_my_groups"), times("comm_chat_thread_list"), times("comm_chat_message_list")]).toEqual([1, 2, 0]);
  });
});
