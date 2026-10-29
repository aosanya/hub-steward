import { callTool } from "../wakala/mcp";
import { loadSubject } from "../wakala/me";
import { listAsks, mcpChatClient } from "./api";

vi.mock("../wakala/mcp", () => ({ callTool: vi.fn() }));
vi.mock("../wakala/me", () => ({ loadSubject: vi.fn().mockResolvedValue("") }));

describe("the real shapes of comm and the market", () => {
  it("reads a message's ask from attachment_kind and attachment_id", async () => {
    (callTool as any).mockResolvedValue({
      items: [
        { id: "m1", structure_id: "s1", thread_id: "t1", author_id: "u1", body: "hi", created_at: "2026-10-28T09:00:00Z", attachment_kind: "ask", attachment_id: "a1" },
        { id: "m2", author_id: "u1", body: "plain", attachment_kind: "order", attachment_id: "o1" },
      ],
    });
    const messages = await mcpChatClient.listMessages("s1", "t1");
    expect(callTool).toHaveBeenCalledWith("", "comm_chat_message_list", { structure_id: "s1", thread_id: "t1" });
    expect(messages[0].askId).toBe("a1");
    expect(messages[1].askId).toBe("");
  });

  it("reads an ask's question, answer and detail", async () => {
    (callTool as any).mockResolvedValue({ items: [{ id: "a1", picker: "p1", question: "2 bags", answer: "waiting", detail: "n" }] });
    expect(await listAsks()).toEqual([{ id: "a1", asker: "p1", question: "2 bags", answer: "waiting", detail: "n" }]);
  });

  it("answers with askID, date and note", async () => {
    (callTool as any).mockResolvedValue({});
    await mcpChatClient.answerAsk("a1", { answer: "yes", date: "2026-11-06", note: "ok" });
    expect(callTool).toHaveBeenLastCalledWith("", "market_answer_ask", { askID: "a1", answer: "yes", date: "2026-11-06", note: "ok" });
  });
});

const lastMessage = (author: string, body: string, at: string, authorId = "u9") => ({
  id: `m-${at}`,
  author_id: authorId,
  author_name: author,
  body,
  created_at: at,
});

const answering = (groups: object[], threadsOf: Record<string, object[] | Error>) => {
  const mocked = callTool as any;
  mocked.mockReset();
  mocked.mockImplementation(async (_hub: string, tool: string, args: Record<string, unknown> = {}) => {
    if (tool === "actor_list_my_groups") return { items: groups };
    if (tool !== "comm_chat_thread_list") throw new Error(`${tool} must not be read to list the rooms`);
    const threads = threadsOf[String(args.structure_id)];
    if (!threads || threads instanceof Error) throw new Error("not a member");
    return { items: threads };
  });
  return mocked;
};

const toolsCalled = (mocked: any) => mocked.mock.calls.map((c: any[]) => c[1]);

describe("rooms from the member's own groups", () => {
  it("lists the member's groups, then the threads of each by structure id", async () => {
    const mocked = answering(
      [{ id: "g1", name: "Siaya Farmers' Group" }, { id: "g2", name: "Lab" }],
      { g1: [{ id: "t1", structure_id: "g1", label: "Suppliers" }] },
    );
    const rooms = await mcpChatClient.listRooms();
    expect(rooms).toEqual([{ id: "g1", name: "Siaya Farmers' Group", threadId: "t1", threadName: "Suppliers", unread: 0, preview: "", lastAt: "" }]);
    expect(toolsCalled(mocked)).toEqual(["actor_list_my_groups", "comm_chat_thread_list", "comm_chat_thread_list"]);
    expect(mocked.mock.calls[1][2]).toEqual({ structure_id: "g1" });
  });
});

describe("one list per group and no read of any thread", () => {
  it("makes 1 + G calls however many threads the groups hold", async () => {
    const mocked = answering(
      [{ id: "g1", name: "Siaya farmers" }, { id: "g2", name: "Suppliers" }, { id: "g3", name: "Lab" }],
      {
        g1: [{ id: "t1", label: "General" }, { id: "t2", label: "Seeds" }, { id: "t3", label: "Urea" }],
        g2: [{ id: "t4", label: "General" }, { id: "t5", label: "Quotes" }],
        g3: [{ id: "t6", label: "General" }],
      },
    );
    const rooms = await mcpChatClient.listRooms();
    expect(rooms).toHaveLength(3);
    expect(mocked).toHaveBeenCalledTimes(1 + 3);
    expect(toolsCalled(mocked)).not.toContain("comm_chat_message_list");
  });
});

describe("one row per group", () => {
  it("adds up the unread of every thread of the room", async () => {
    answering(
      [{ id: "s1", name: "Siaya farmers" }],
      { s1: [{ id: "t1", label: "Farmers", unread: 100 }, { id: "t2", label: "Other", unread: 3 }, { id: "t3", label: "Quiet" }] },
    );
    const rooms = await mcpChatClient.listRooms();
    expect(rooms.map((r) => [r.id, r.unread])).toEqual([["s1", 103]]);
  });

  it("opens the thread its newest message is in and previews that message", async () => {
    answering(
      [{ id: "s1", name: "Siaya farmers" }],
      {
        s1: [
          { id: "t1", label: "General", last_message_at: "2026-10-28T08:00:00Z", last_message: lastMessage("Asha Otieno", "first", "2026-10-28T08:00:00Z") },
          { id: "t2", label: "Urea", last_message_at: "2026-10-28T09:30:00Z", last_message: lastMessage("Grace Adhiambo", "I started a group order for urea.", "2026-10-28T09:30:00Z") },
          { id: "t3", label: "Seeds" },
        ],
      },
    );
    const [room] = await mcpChatClient.listRooms();
    expect([room.threadId, room.threadName]).toEqual(["t2", "Urea"]);
    expect(room.preview).toBe("Grace Adhiambo: I started a group order for urea.");
    expect(room.lastAt).toBe("2026-10-28T09:30:00Z");
  });

  it("opens the General thread of a group nobody has posted in", async () => {
    answering(
      [{ id: "s1", name: "Siaya farmers" }],
      { s1: [{ id: "t1", label: "Urea", audience: "leads" }, { id: "t2", label: "General", audience: "group" }] },
    );
    const [room] = await mcpChatClient.listRooms();
    expect([room.threadId, room.preview, room.lastAt]).toEqual(["t2", "", ""]);
  });

  it("orders the rooms newest first and leaves a silent one last", async () => {
    answering(
      [{ id: "g1", name: "Silent" }, { id: "g2", name: "Older" }, { id: "g3", name: "Newer" }],
      {
        g1: [{ id: "t1", label: "General" }],
        g2: [{ id: "t2", label: "General", last_message: lastMessage("Asha Otieno", "earlier", "2026-10-28T09:05:00Z") }],
        g3: [{ id: "t3", label: "General", last_message: lastMessage("Baraka Odhiambo", "later", "2026-10-28T14:20:00Z") }],
      },
    );
    const rooms = await mcpChatClient.listRooms();
    expect(rooms.map((r) => r.name)).toEqual(["Newer", "Older", "Silent"]);
  });

  it("writes You for the signed-in member's own message", async () => {
    (loadSubject as any).mockResolvedValue("u1");
    answering(
      [{ id: "s1", name: "Siaya farmers" }],
      { s1: [{ id: "t1", label: "Farmers", last_message: lastMessage("Joseph Otieno", "yes", "2026-10-28T09:30:00Z", "u1") }] },
    );
    const [room] = await mcpChatClient.listRooms();
    expect(room.preview).toBe("You: yes");
  });

  it("keeps the time of a thread whose last message is absent", async () => {
    answering([{ id: "s1", name: "Siaya farmers" }], { s1: [{ id: "t1", label: "Farmers", last_message_at: "2026-10-28T08:00:00Z" }] });
    const [room] = await mcpChatClient.listRooms();
    expect([room.preview, room.lastAt]).toEqual(["", "2026-10-28T08:00:00Z"]);
  });

  it("drops a group whose threads cannot be listed instead of failing the tab", async () => {
    answering([{ id: "g1", name: "Down" }, { id: "g2", name: "Up" }], { g1: new Error("down"), g2: [{ id: "t2", label: "General" }] });
    const rooms = await mcpChatClient.listRooms();
    expect(rooms.map((r) => r.name)).toEqual(["Up"]);
  });
});

describe("who wrote a message", () => {
  it("shows the author's name and marks the signed-in member's own messages", async () => {
    (loadSubject as any).mockResolvedValue("u1");
    (callTool as any).mockResolvedValue({
      items: [
        { id: "m1", author_id: "u1", author_name: "Joseph Otieno", body: "yes" },
        { id: "m2", author_id: "u2", author_name: "Asha Otieno", body: "asks" },
        { id: "m3", author_id: "u3", body: "no name" },
      ],
    });
    const messages = await mcpChatClient.listMessages("s1", "t1");
    expect(messages.map((m) => [m.author, m.mine])).toEqual([
      ["Joseph Otieno", true],
      ["Asha Otieno", false],
      ["u3", false],
    ]);
  });
});
