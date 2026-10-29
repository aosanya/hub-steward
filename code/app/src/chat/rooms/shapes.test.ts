import { callTool } from "../../wakala/mcp";
import { loadSubject } from "../../wakala/me";
import { askFor, mcpRoomsClient, messageOf, orderFor, threadOf } from "./api";
import { dayLabel } from "./time";

vi.mock("../../wakala/mcp", () => ({ callTool: vi.fn() }));
vi.mock("../../wakala/me", () => ({ loadSubject: vi.fn().mockResolvedValue("u1") }));

const mocked = callTool as unknown as ReturnType<typeof vi.fn>;

describe("the shapes of comm and the market", () => {
  beforeEach(() => mocked.mockReset());

  it("reads a message's attachment from attachment_kind and attachment_id and marks her own", () => {
    const read = messageOf("u1")({ id: "m1", author_id: "u1", author_name: "Grace", body: "hi", created_at: "2026-10-28T09:00:00Z", attachment_kind: "group_order", attachment_id: "go1" });
    expect(read).toMatchObject({ mine: true, author: "Grace", kind: "group_order", targetId: "go1", agent: false });
  });

  it("does not mark a message as hers when she is not known", () => {
    expect(messageOf("")({ author_id: "" }).mine).toBe(false);
  });

  it("reads a thread's audience, requester, unread and decline", () => {
    expect(threadOf("u1")({ id: "t", label: "Ask", audience: "leads", requested_by: "u1", unread: 2, declined_at: "2026-10-28T10:00:00Z", last_message_at: "x" })).toEqual({
      id: "t",
      label: "Ask",
      audience: "leads",
      requestedBy: "u1",
      declined: true,
      unread: 2,
      lastMessageAt: "x",
      preview: "",
    });
  });

  it("reads a thread's preview and time from its last_message, writing You for her own", () => {
    const last = (authorId: string) => ({ id: "m1", author_id: authorId, author_name: "Grace Adhiambo", body: "Count me in.", created_at: "2026-10-28T09:30:00Z" });
    const listed = (authorId: string) => threadOf("u1")({ id: "t", label: "General", audience: "group", last_message_at: "2026-10-28T08:00:00Z", last_message: last(authorId) });
    expect(listed("u9")).toMatchObject({ preview: "Grace Adhiambo: Count me in.", lastMessageAt: "2026-10-28T09:30:00Z" });
    expect(listed("u1")).toMatchObject({ preview: "You: Count me in." });
    expect(threadOf("u1")({ id: "t", last_message_at: "2026-10-28T08:00:00Z" })).toMatchObject({ preview: "", lastMessageAt: "2026-10-28T08:00:00Z" });
  });

  it("reads the thread list alone for a room, with no message list for any thread", async () => {
    const last = (id: string) => ({ id: `m-${id}`, author_id: "u9", author_name: "Grace Adhiambo", body: `post ${id}`, created_at: "2026-10-28T09:30:00Z" });
    mocked.mockResolvedValue({ items: ["t1", "t2", "t3"].map((id) => ({ id, label: id, audience: "group", last_message: last(id) })) });
    const threads = await mcpRoomsClient.listThreads("s1");
    expect(threads.map((thread) => thread.preview)).toEqual(["Grace Adhiambo: post t1", "Grace Adhiambo: post t2", "Grace Adhiambo: post t3"]);
    expect(mocked.mock.calls.map(([, tool]) => tool)).toEqual(["comm_chat_thread_list"]);
  });

  it("still lists the threads when the member cannot be read", async () => {
    (loadSubject as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("down"));
    mocked.mockResolvedValue({ items: [{ id: "t1", label: "General", audience: "group", last_message: { author_id: "u1", author_name: "Asha Otieno", body: "hi", created_at: "2026-10-28T09:30:00Z" } }] });
    expect((await mcpRoomsClient.listThreads("s1")).map((thread) => thread.preview)).toEqual(["Asha Otieno: hi"]);
  });

  it("finds her own line of a group order by the picker id", () => {
    const raw = { id: "go1", lines: [{ picker: "u9", quantity: 5, answer: "yes" }, { picker: "u1", quantity: 2, answer: "waiting" }] };
    expect(orderFor("u1", raw)).toMatchObject({ myQuantity: 2, myAnswer: "waiting" });
    expect(orderFor("", raw)).toMatchObject({ myQuantity: 0, myAnswer: "" });
  });

  it("marks an ask hers by the picker and names the poster", () => {
    const ask = askFor("u1", new Map([["p1", "Siaya Farm Stores"]]), { id: "a1", picker: "u1", poster_id: "p1", answer: "yes", detail: "d" });
    expect(ask).toMatchObject({ mine: true, posterName: "Siaya Farm Stores", answer: "yes" });
  });

  it("names the order's product with the words of the cheapest offer for it", () => {
    const raw = { id: "go1", product: "urea", lines: [] };
    const offers = [
      { id: "o1", product: "urea", product_words: "Urea 50kg", price: 3800 },
      { id: "o2", product: "urea", product_words: "Urea DAP 50kg", price: 3600 },
      { id: "o3", product: "maize", product_words: "Maize flour", price: 100 },
    ];
    expect(orderFor("u1", raw, offers).productWords).toBe("Urea DAP 50kg");
  });

  it("keeps the product as the data holds it when no offer has words, and names none when the order holds none", () => {
    expect(orderFor("u1", { id: "go1", product: "urea" }).productWords).toBe("urea");
    expect(orderFor("u1", { id: "go1", product: "urea" }, [{ product: "urea", price: 3800 }]).productWords).toBe("urea");
    expect(orderFor("u1", { id: "go1" }, [{ product: "", product_words: "Loose item", price: 1 }]).productWords).toBe("");
  });

  it("reads the offers beside the order when it draws an order", async () => {
    mocked.mockImplementation(async (_scope: string, tool: string) => {
      if (tool === "market_get_group_order") return { id: "go1", product: "urea", lines: [] };
      if (tool === "market_list_offers") return { items: [{ id: "o1", product: "urea", product_words: "Urea 50kg", price: 3800 }] };
      return { items: [] };
    });
    expect(await mcpRoomsClient.getOrder("go1")).toMatchObject({ productWords: "Urea 50kg" });
    expect(mocked).toHaveBeenCalledWith("", "market_list_offers", {});
  });

  it("still draws the order with the product as held when the offers cannot be read", async () => {
    mocked.mockImplementation(async (_scope: string, tool: string) => {
      if (tool === "market_get_group_order") return { id: "go1", product: "urea", lines: [] };
      if (tool === "market_list_offers") throw new Error("down");
      return { items: [] };
    });
    expect(await mcpRoomsClient.getOrder("go1")).toMatchObject({ order: { id: "go1" }, productWords: "urea" });
  });

  it("takes the Buy now ids from the shop's yes and the offer's product", () => {
    const raw = { id: "a1", picker: "u1", poster_id: "p1", answer: "yes", offer_id: "o0" };
    const yeses = [{ id: "y9", ask_id: "a2", offer_id: "o9" }, { id: "y1", ask_id: "a1", offer_id: "o1" }];
    const offers = [{ id: "o1", product: "seed-614" }];
    expect(askFor("u1", new Map(), raw, yeses, offers)).toMatchObject({ offerId: "o1", productId: "seed-614", yesId: "y1" });
  });

  it("falls back to the ask's own offer and to the offer id for the product", () => {
    expect(askFor("u1", new Map(), { id: "a1", offer_id: "o0" })).toMatchObject({ offerId: "o0", productId: "o0", yesId: "" });
    expect(askFor("u1", new Map(), { id: "a1" })).toMatchObject({ offerId: "", productId: "", yesId: "" });
  });

  it("reads the yeses and offers beside the asks when it draws an ask", async () => {
    mocked.mockImplementation(async (_scope: string, tool: string) => {
      if (tool === "market_list_asks") return { items: [{ id: "a1", picker: "u1", poster_id: "p1", answer: "yes" }] };
      if (tool === "market_list_yeses") return { items: [{ id: "y1", ask_id: "a1", offer_id: "o1" }] };
      if (tool === "market_list_offers") return { items: [{ id: "o1", product: "seed-614" }] };
      return { items: [] };
    });
    expect(await mcpRoomsClient.getAsk("a1")).toMatchObject({ offerId: "o1", productId: "seed-614", yesId: "y1" });
  });

  it("still draws the ask when yeses or offers cannot be read", async () => {
    mocked.mockImplementation(async (_scope: string, tool: string) => {
      if (tool === "market_list_asks") return { items: [{ id: "a1", picker: "u1", answer: "yes" }] };
      if (tool === "market_list_yeses" || tool === "market_list_offers") throw new Error("down");
      return { items: [] };
    });
    expect(await mcpRoomsClient.getAsk("a1")).toMatchObject({ id: "a1", offerId: "", yesId: "" });
  });

  it("calls comm and the market with the confirmed tool and argument names", async () => {
    mocked.mockResolvedValue({ items: [], id: "t9" });
    await mcpRoomsClient.listThreads("s1");
    await mcpRoomsClient.listMessages("s1", "t1");
    await mcpRoomsClient.post("s1", "t1", "hello");
    expect(await mcpRoomsClient.startThread("s1", "Printing")).toBe("t9");
    await mcpRoomsClient.answerRevision("go1", "no");
    expect(mocked.mock.calls.map(([, tool, args]) => [tool, args])).toEqual([
      ["comm_chat_thread_list", { structure_id: "s1" }],
      ["comm_chat_message_list", { structure_id: "s1", thread_id: "t1" }],
      ["comm_chat_message_post", { structure_id: "s1", thread_id: "t1", body: "hello" }],
      ["comm_chat_thread_create", { structure_id: "s1", label: "Printing" }],
      ["market_answer_revision", { groupOrderID: "go1", answer: "no" }],
    ]);
    expect(loadSubject).toHaveBeenCalled();
  });

  it("names the room from the member's groups", async () => {
    mocked.mockResolvedValue({ items: [{ id: "s1", name: "Siaya farmers" }, { id: "s2", name: "Lab" }] });
    expect(await mcpRoomsClient.roomName("s2")).toBe("Lab");
  });

  it("labels a day as Today or by weekday", () => {
    const now = new Date(2026, 9, 28, 15, 0);
    expect(dayLabel(new Date(2026, 9, 28, 9, 0).toISOString(), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 27, 9, 0).toISOString(), now)).toBe("Tue 27 Oct");
  });
});
