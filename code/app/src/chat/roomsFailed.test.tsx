import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ChatPage } from "../pages/chat/ChatPage";
import { callTool } from "../wakala/mcp";
import { forgetOpenAgency, openAgency } from "../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

vi.mock("../wakala/mcp", () => ({ callTool: vi.fn() }));
vi.mock("../wakala/me", () => ({ loadSubject: vi.fn().mockResolvedValue("u1") }));

const thread = { id: "t1", label: "General", audience: "group", unread: 0, last_message_at: new Date().toISOString() };

const answer = (threadList: (structureId: unknown) => Promise<unknown>) => {
  const mocked = callTool as any;
  mocked.mockReset();
  mocked.mockImplementation(async (_hub: string, tool: string, args: Record<string, unknown> = {}) => {
    if (tool === "actor_list_my_groups") return { items: [{ id: "g1", name: "Siaya farmers" }, { id: "g2", name: "Suppliers" }] };
    return threadList(args.structure_id);
  });
};

const show = () =>
  render(
    <MemoryRouter>
      <ChatPage />
    </MemoryRouter>,
  );

describe("chat tab when thread lists fail", () => {
  it("says Chat could not be loaded when every group's thread list fails", async () => {
    answer(async () => {
      throw new Error("down");
    });
    show();
    expect(await screen.findByText("Chat could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByText("No rooms yet.")).toBeNull();
  });

  it("still draws the groups that answered when only some thread lists fail", async () => {
    answer(async (id) => {
      if (id === "g2") throw new Error("down");
      return { items: [thread] };
    });
    show();
    expect(await screen.findByText("Siaya farmers")).toBeInTheDocument();
    expect(screen.queryByText("Chat could not be loaded.")).toBeNull();
  });

  it("says No rooms yet when the groups have no threads at all", async () => {
    answer(async () => ({ items: [] }));
    show();
    expect(await screen.findByText("No rooms yet.")).toBeInTheDocument();
  });
});
