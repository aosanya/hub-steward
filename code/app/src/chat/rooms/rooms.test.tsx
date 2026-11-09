import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import type { GroupOrder } from "../../supply/groupOrder/api";
import type { RoomAsk, RoomMessage, RoomOrder, RoomThread, RoomsClient } from "./api";
import { RoomThreadPage } from "./RoomThreadPage";
import { RoomThreadsPage } from "./RoomThreadsPage";
import { timeOf } from "./time";
import { routes } from "../../routes";
import { forgetOpenAgency, openAgency } from "../../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const message = (over: Partial<RoomMessage>): RoomMessage => ({
  id: "m",
  author: "Grace Adhiambo",
  agent: false,
  mine: false,
  body: "",
  at: "2026-10-28T09:12:00Z",
  kind: "",
  targetId: "",
  ...over,
});

const order = (over: Partial<GroupOrder>): GroupOrder => ({
  id: "go1",
  posterId: "p1",
  product: "urea",
  productWords: "Urea 50kg",
  coordinator: "Grace Adhiambo",
  price: 3600,
  minimum: 20,
  termsVersion: 1,
  startedWith: null,
  state: "open",
  total: 0,
  count: 0,
  lines: [],
  ...over,
});

const roomOrder = (over: Partial<RoomOrder> = {}): RoomOrder => ({
  order: order({}),
  productWords: "Urea 50kg",
  myQuantity: 0,
  myAnswer: "",
  ...over,
});

const thread = (over: Partial<RoomThread>): RoomThread => ({
  id: "t1",
  label: "General",
  audience: "group",
  requestedBy: "",
  declined: false,
  unread: 0,
  lastMessageAt: "",
  preview: "",
  ...over,
});

type Fixture = {
  messages?: RoomMessage[];
  threads?: RoomThread[];
  order?: RoomOrder;
  ask?: RoomAsk | null;
  room?: string;
};

const fake = (f: Fixture): RoomsClient => ({
  subject: vi.fn().mockResolvedValue("u1"),
  roomName: vi.fn().mockResolvedValue(f.room ?? "Siaya farmers"),
  listThreads: vi.fn().mockResolvedValue(f.threads ?? [thread({})]),
  listMessages: vi.fn().mockResolvedValue(f.messages ?? []),
  post: vi.fn().mockResolvedValue(undefined),
  startThread: vi.fn().mockResolvedValue("t9"),
  getOrder: vi.fn().mockResolvedValue(f.order ?? roomOrder()),
  answerRevision: vi.fn().mockResolvedValue(undefined),
  getAsk: vi.fn().mockResolvedValue(f.ask ?? null),
});

function BuyStub() {
  const { productId, offerId } = useParams();
  const yes = useSearchParams()[0].get("yes");
  return <p>{`buying ${productId} ${offerId} yes=${yes}`}</p>;
}

const show = (client: RoomsClient, entry: string, heading?: "room" | "thread") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/chat" element={<p>the chat list</p>} />
        <Route path={routes.roomThreads.pattern} element={<RoomThreadsPage client={client} />} />
        <Route path={routes.roomThread.pattern} element={<RoomThreadPage client={client} heading={heading} />} />
        <Route path={routes.ask.pattern} element={<p>the ask page</p>} />
        <Route path={routes.buyNow.pattern} element={<BuyStub />} />
        <Route path={routes.joinGroupOrder.pattern} element={<p>the join page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("the farmers' room", () => {
  it("draws the group order card from the order and opens Join by path", async () => {
    const coordinator = message({ id: "m1", body: "I started a group order for urea.", kind: "group_order", targetId: "go1" });
    show(fake({ messages: [coordinator] }), "/a/farmers/chat/r1/t1");
    expect(await screen.findByText("Urea 50kg group order")).toBeInTheDocument();
    expect(screen.getByText("KES 3,600 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/a/farmers/market/urea/group-orders/go1/join");
    await userEvent.click(screen.getByRole("link", { name: "Join" }));
    expect(await screen.findByText("the join page")).toBeInTheDocument();
  });

  it("titles the card with the shop's words, not the product key", async () => {
    show(fake({ messages: [message({ kind: "group_order", targetId: "go1" })], order: roomOrder({ productWords: "Maize flour 2kg" }) }), "/a/farmers/chat/r1/t1");
    expect(await screen.findByText("Maize flour 2kg group order")).toBeInTheDocument();
    expect(screen.queryByText(/urea/i)).toBeNull();
  });

  it("titles the card plain Group order when the order names no product", async () => {
    show(fake({ messages: [message({ kind: "group_order", targetId: "go1" })], order: roomOrder({ productWords: "" }) }), "/a/farmers/chat/r1/t1");
    expect(await screen.findByText("Group order")).toBeInTheDocument();
  });

  it("titles the revision with the shop's words and plain Group order without them", async () => {
    const revising = (productWords: string) => roomOrder({ order: order({ state: "revising" }), productWords, myAnswer: "waiting" });
    const first = show(fake({ messages: [message({ kind: "group_order", targetId: "go1" })], order: revising("Urea 50kg") }), "/a/farmers/chat/r1/t1");
    expect(await screen.findByText("Urea 50kg group order")).toBeInTheDocument();
    first.unmount();
    show(fake({ messages: [message({ kind: "group_order", targetId: "go1" })], order: revising("") }), "/a/farmers/chat/r1/t1");
    expect(await screen.findByText("Group order")).toBeInTheDocument();
  });

  it("offers no Join on an order that is no longer open, whatever the agent's words say", async () => {
    const agent = message({ id: "m1", agent: true, body: "Join the urea group order now.", kind: "group_order", targetId: "go1" });
    const closed = roomOrder({ order: order({ state: "closed" }) });
    show(fake({ messages: [agent], order: closed }), "/a/farmers/chat/r1/t1");
    expect(await screen.findByText("Urea 50kg group order")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Join" })).toBeNull();
  });

  it("shows the revision with her own line and sends Yes only when she presses it", async () => {
    const revising = roomOrder({
      order: order({ state: "revising", price: 3700, startedWith: { price: 3600, minimum: 20 } }),
      myQuantity: 2,
      myAnswer: "waiting",
    });
    const agent = message({ id: "m1", agent: true, author: "Farmers' agent", body: "Kisumu Agro Supplies changed the order. Do you accept?", kind: "group_order", targetId: "go1" });
    const client = fake({ messages: [agent], order: revising });
    show(client, "/a/farmers/chat/r1/t1");
    expect(await screen.findByText("Now KES 3,700 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getByText("Started with KES 3,600 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getByText("Your line: 2 bags")).toBeInTheDocument();
    expect(client.answerRevision).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(client.answerRevision).toHaveBeenCalledWith("go1", "yes");
  });

  it("answers No on a revision", async () => {
    const revising = roomOrder({ order: order({ state: "revising" }), myQuantity: 2, myAnswer: "waiting" });
    const client = fake({ messages: [message({ kind: "group_order", targetId: "go1" })], order: revising });
    show(client, "/a/farmers/chat/r1/t1");
    await userEvent.click(await screen.findByRole("button", { name: "No" }));
    expect(client.answerRevision).toHaveBeenCalledWith("go1", "no");
  });

  it("offers Ask shops and Put up a notice on the agent's want card", async () => {
    const agent = message({ id: "m1", agent: true, author: "Farmers' agent", body: "No shop has listed it.", kind: "request", targetId: "rq1" });
    show(fake({ messages: [agent], threads: [thread({ id: "t1", label: "Hybrid maize seed 614" })] }), "/a/farmers/chat/r1/t1");
    expect(await screen.findByRole("link", { name: "Ask shops" })).toHaveAttribute("href", "/buy/wanted/rq1/ask?what=Hybrid+maize+seed+614");
    expect(screen.getByRole("link", { name: "Put up a notice" })).toHaveAttribute("href", "/buy/wanted");
    expect(screen.getAllByText("Hybrid maize seed 614").length).toBeGreaterThan(0);
  });

  it("draws what a shop answered from the ask record", async () => {
    const found: RoomAsk = { id: "a1", mine: true, posterName: "Siaya Farm Stores", answer: "yes", question: "seed", detail: "KES 1,850 for 10 kg", offerId: "", productId: "", yesId: "" };
    const agent = message({ id: "m1", agent: true, body: "Some shop has it.", kind: "ask", targetId: "a1" });
    show(fake({ messages: [agent], ask: found, threads: [thread({ label: "Hybrid maize seed 614" })] }), "/a/farmers/chat/r1/t1");
    expect(await screen.findByText("Siaya Farm Stores · KES 1,850 for 10 kg")).toBeInTheDocument();
  });

  it("puts Buy now on the Found card and opens the buy page with the shop's yes", async () => {
    const found: RoomAsk = { id: "a1", mine: true, posterName: "Siaya Farm Stores", answer: "yes", question: "seed", detail: "KES 1,850 for 10 kg", offerId: "o1", productId: "seed-614", yesId: "y1" };
    const agent = message({ id: "m1", agent: true, body: "Some shop has it.", kind: "ask", targetId: "a1" });
    show(fake({ messages: [agent], ask: found }), "/a/farmers/chat/r1/t1");
    const buy = await screen.findByRole("link", { name: "Buy now" });
    expect(buy).toHaveAttribute("href", "/a/farmers/market/seed-614/buy/o1?yes=y1");
    await userEvent.click(buy);
    expect(await screen.findByText("buying seed-614 o1 yes=y1")).toBeInTheDocument();
  });

  it("leaves the yes off the Buy now link when no yes is held", async () => {
    const found: RoomAsk = { id: "a1", mine: true, posterName: "Siaya Farm Stores", answer: "yes", question: "seed", detail: "", offerId: "o1", productId: "seed-614", yesId: "" };
    const agent = message({ id: "m1", agent: true, body: "Some shop has it.", kind: "ask", targetId: "a1" });
    show(fake({ messages: [agent], ask: found }), "/a/farmers/chat/r1/t1");
    expect(await screen.findByRole("link", { name: "Buy now" })).toHaveAttribute("href", "/a/farmers/market/seed-614/buy/o1");
  });

  it("shows no Buy now on a Found card that names no offer", async () => {
    const found: RoomAsk = { id: "a1", mine: true, posterName: "Siaya Farm Stores", answer: "yes", question: "seed", detail: "KES 1,850", offerId: "", productId: "", yesId: "y1" };
    const agent = message({ id: "m1", agent: true, body: "Some shop has it.", kind: "ask", targetId: "a1" });
    show(fake({ messages: [agent], ask: found }), "/a/farmers/chat/r1/t1");
    expect(await screen.findByText("Siaya Farm Stores · KES 1,850")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Buy now" })).toBeNull();
  });

  it("shows no Buy now on a shop that has not said yes", async () => {
    const waiting: RoomAsk = { id: "a1", mine: true, posterName: "Kisumu Agro Supplies", answer: "waiting", question: "seed", detail: "", offerId: "o1", productId: "seed-614", yesId: "" };
    const agent = message({ id: "m1", agent: true, body: "Kisumu Agro Supplies has not answered.", kind: "ask", targetId: "a1" });
    const client = fake({ messages: [agent], ask: waiting });
    show(client, "/a/farmers/chat/r1/t1");
    await screen.findByText("Kisumu Agro Supplies has not answered.");
    expect(client.getAsk).toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Buy now" })).toBeNull();
  });

  it("draws nothing for a shop that has not said yes", async () => {
    const waiting: RoomAsk = { id: "a1", mine: true, posterName: "Kisumu Agro Supplies", answer: "waiting", question: "seed", detail: "", offerId: "o1", productId: "seed-614", yesId: "" };
    const agent = message({ id: "m1", agent: true, body: "Kisumu Agro Supplies has not answered.", kind: "ask", targetId: "a1" });
    const client = fake({ messages: [agent], ask: waiting });
    show(client, "/a/farmers/chat/r1/t1");
    expect(await screen.findByText("Kisumu Agro Supplies has not answered.")).toBeInTheDocument();
    expect(client.getAsk).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Answer the ask" })).toBeNull();
  });

  it("keeps Answer the ask for an ask put to her as a poster", async () => {
    const put: RoomAsk = { id: "a1", mine: false, posterName: "", answer: "waiting", question: "2 bags", detail: "", offerId: "", productId: "", yesId: "" };
    const agent = message({ id: "m1", agent: true, body: "Asha Otieno asks: 2 bags.", kind: "ask", targetId: "a1" });
    show(fake({ messages: [agent], ask: put }), "/a/farmers/chat/r1/t1");
    await userEvent.click(await screen.findByRole("button", { name: "Answer the ask" }));
    expect(await screen.findByText("the ask page")).toBeInTheDocument();
  });

  it("marks the agent and her own lines, and names the room and the thread", async () => {
    const own = message({ id: "m1", mine: true, author: "u1", body: "Who sells hybrid maize seed 614?" });
    const agent = message({ id: "m2", agent: true, author: "Farmers' agent", body: "No shop has listed it." });
    show(fake({ messages: [own, agent], threads: [thread({ label: "Hybrid maize seed 614" })] }), "/a/farmers/chat/r1/t1");
    expect(await screen.findByRole("heading", { name: "Siaya farmers" })).toBeInTheDocument();
    expect(await screen.findAllByText("Hybrid maize seed 614")).not.toHaveLength(0);
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });

  it("centres the room's name in the bar between a Chat back label and the menu, with the thread's name as a plain pill beneath", async () => {
    show(fake({ messages: [message({})], threads: [thread({ label: "Hybrid maize seed 614" })] }), "/a/farmers/chat/r1/t1");
    const title = await screen.findByRole("heading", { level: 1, name: "Siaya farmers" });
    const bar = screen.getByRole("banner");
    expect(bar).toContainElement(title);
    expect(within(bar).getByRole("button", { name: "‹ Chat" })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Menu" })).toBeInTheDocument();
    const main = screen.getByRole("main");
    const pill = main.querySelector(".chip");
    expect(pill).toHaveTextContent("Hybrid maize seed 614");
    expect(pill?.tagName).toBe("SPAN");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("holds the threads in a card whose header says how many, open at first and collapsible", async () => {
    const threads = [thread({ preview: "hello" }), thread({ id: "t2", label: "Seeds", unread: 2 })];
    show(fake({ threads }), "/a/farmers/chat/r1/t1");
    const header = await screen.findByRole("button", { name: "Threads · 2" });
    expect(header).toHaveAttribute("aria-expanded", "true");
    const card = header.closest(".card") as HTMLElement;
    expect(within(card).getByRole("button", { name: /Seeds/ })).toBeInTheDocument();
    expect(card.querySelectorAll("button.row.room")).toHaveLength(2);
    await userEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(card.querySelectorAll("button.row.room")).toHaveLength(0);
  });

  it("starts a new thread from the threads card and opens it", async () => {
    const client = fake({ threads: [thread({})] });
    show(client, "/a/farmers/chat/r1/t1");
    await userEvent.click(await screen.findByRole("button", { name: "Start a thread" }));
    await userEvent.type(screen.getByLabelText("What is the thread about?"), "Printing");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(client.startThread).toHaveBeenCalledWith("r1", "Printing");
    await waitFor(() => expect(client.listMessages).toHaveBeenCalledWith("r1", "t9"));
  });

  it("opens another thread from a row of the threads card", async () => {
    const client = fake({ threads: [thread({}), thread({ id: "t2", label: "Seeds" })] });
    show(client, "/a/farmers/chat/r1/t1");
    await userEvent.click(await screen.findByRole("button", { name: /Seeds/ }));
    expect(client.listMessages).toHaveBeenCalledWith("r1", "t2");
  });

  it("sends what she writes to the thread and reads the thread again", async () => {
    const client = fake({ messages: [message({ body: "hello" })] });
    show(client, "/a/farmers/chat/r1/t1");
    await userEvent.type(await screen.findByRole("textbox", { name: "Write to Siaya farmers" }), "Count me in");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(client.post).toHaveBeenCalledWith("r1", "t1", "Count me in");
    expect(client.listMessages).toHaveBeenCalledTimes(2);
  });
});

describe("what heads a thread page when the app routes it by thread", () => {
  const named = thread({ id: "t2", label: "Hybrid maize seed 614" });

  const headOf = async () => {
    const title = await screen.findByRole("heading", { level: 1 });
    await screen.findByRole("button", { name: /^Threads/ });
    return { title: title.textContent, sub: screen.getByRole("main").querySelector(".chip")?.textContent };
  };

  it("heads General with the room's name from the member's groups and puts General beneath it", async () => {
    const client = fake({ threads: [thread({}), named] });
    show(client, "/a/farmers/chat/r1/t1", "thread");
    expect(await headOf()).toEqual({ title: "Siaya farmers", sub: "General" });
    expect(client.roomName).toHaveBeenCalledWith("r1");
  });

  it("heads a named thread with its own name and puts the room's name beneath it", async () => {
    show(fake({ threads: [thread({}), named] }), "/a/farmers/chat/r1/t2", "thread");
    expect(await headOf()).toEqual({ title: "Hybrid maize seed 614", sub: "Siaya farmers" });
  });

  it("heads the lab's General with the lab's name", async () => {
    show(fake({ room: "Siaya Community Computer Lab", threads: [thread({}), thread({ id: "t2", label: "Ask for a seat", audience: "leads", requestedBy: "u1" })] }), "/a/farmers/chat/r1/t1", "thread");
    expect(await headOf()).toEqual({ title: "Siaya Community Computer Lab", sub: "General" });
  });

  it("heads a request to the leaders with its own name", async () => {
    show(fake({ room: "Siaya Community Computer Lab", threads: [thread({}), thread({ id: "t2", label: "Ask for a seat", audience: "leads", requestedBy: "u1" })] }), "/a/farmers/chat/r1/t2", "thread");
    expect(await headOf()).toEqual({ title: "Ask for a seat", sub: "Siaya Community Computer Lab" });
  });
});

describe("the lab's room", () => {
  const lab = { room: "Siaya Community Computer Lab" };

  it("opens on General with Hub Steward's answer and the Assets Keeper's line", async () => {
    const messages = [
      message({ id: "m1", mine: true, author: "u1", body: "What are the opening hours on Saturday?" }),
      message({ id: "m2", author: "Hub Steward", body: "On Saturday the lab is open from 09:00 to 18:00." }),
      message({ id: "m3", mine: true, author: "u1", body: "Which equipment is mine?", at: "2026-10-28T14:05:00Z" }),
      message({ id: "m4", author: "Assets Keeper", body: "You hold: Laptop L-014", at: "2026-10-28T14:05:00Z" }),
    ];
    show(fake({ ...lab, messages, threads: [thread({}), thread({ id: "t2", label: "Ask for a seat", audience: "leads", requestedBy: "u1" })] }), "/a/farmers/chat/r1/t1");
    expect(await screen.findByRole("heading", { name: "Siaya Community Computer Lab" })).toBeInTheDocument();
    expect(screen.getByText("Hub Steward")).toBeInTheDocument();
    expect(screen.getByText("You hold: Laptop L-014")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Threads · 2" })).toBeInTheDocument();
    expect(screen.getAllByText("Wed 28 Oct")).toHaveLength(1);
  });

  it("lists the threads with her request marked, and opens one", async () => {
    const threads = [
      thread({ lastMessageAt: "2026-10-28T14:05:00Z" }),
      thread({ id: "t2", label: "Ask for a seat and a Wi-Fi account", audience: "leads", requestedBy: "u1", unread: 1 }),
    ];
    show(fake({ ...lab, threads }), "/a/farmers/chat/r1/threads");
    expect(await screen.findByText("Your request · with the leaders")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Ask for a seat and a Wi-Fi account/ }));
    expect(await screen.findByText("Leaders only · members cannot see this yet")).toBeInTheDocument();
  });

  it("draws each thread's preview and time from the thread list alone, under its title", async () => {
    const threads = [
      thread({ lastMessageAt: "2026-10-28T14:05:00Z", preview: "Assets Keeper: You hold: Laptop L-014" }),
      thread({ id: "t2", label: "Printing" }),
    ];
    const client = fake({ ...lab, threads });
    show(client, "/a/farmers/chat/r1/threads");
    expect(await screen.findByText("Assets Keeper: You hold: Laptop L-014")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /General/ })).getByText(timeOf("2026-10-28T14:05:00Z"))).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /Printing/ })).queryByText(/^\d\d:\d\d$/)).toBeNull();
    expect(client.listThreads).toHaveBeenCalledTimes(1);
    expect(client.listMessages).not.toHaveBeenCalled();
  });

  it("reads no message list for any thread, however many threads have a post", async () => {
    const threads = ["t1", "t2", "t3", "t4"].map((id, index) =>
      thread({ id, label: `Thread ${index + 1}`, lastMessageAt: "2026-10-28T14:05:00Z", preview: `Grace Adhiambo: post ${index + 1}` }),
    );
    const client = fake({ ...lab, threads });
    show(client, "/a/farmers/chat/r1/threads");
    expect(await screen.findByText("Grace Adhiambo: post 4")).toBeInTheDocument();
    expect(screen.getAllByText(/^Grace Adhiambo: post /)).toHaveLength(4);
    expect(client.listMessages).toHaveBeenCalledTimes(0);
    expect(client.listThreads).toHaveBeenCalledTimes(1);
  });

  it("shows her own last message as it is given and nothing for a thread nobody wrote in", async () => {
    const threads = [
      thread({ lastMessageAt: "2026-10-28T14:05:00Z", preview: "You: Which equipment is mine?" }),
      thread({ id: "t2", label: "Printing" }),
    ];
    show(fake({ ...lab, threads }), "/a/farmers/chat/r1/threads");
    expect(await screen.findByText("You: Which equipment is mine?")).toBeInTheDocument();
    expect(screen.getAllByText(/: /)).toHaveLength(1);
  });

  it("lists a thread with no preview when the list carries no last message", async () => {
    show(fake({ ...lab, threads: [thread({ lastMessageAt: "2026-10-28T14:05:00Z" })] }), "/a/farmers/chat/r1/threads");
    expect(await screen.findByText("General")).toBeInTheDocument();
    expect(screen.queryByText(/: /)).toBeNull();
  });

  it("shows another member's leads thread as with the leaders, not as hers", async () => {
    const threads = [thread({ id: "t2", label: "Ask for a seat", audience: "leads", requestedBy: "u7" })];
    show(fake({ ...lab, threads }), "/a/farmers/chat/r1/threads");
    expect(await screen.findByText("With the leaders")).toBeInTheDocument();
    expect(screen.queryByText("Your request · with the leaders")).toBeNull();
  });

  it("takes the writing box away from a declined request", async () => {
    const threads = [thread({ audience: "leads", requestedBy: "u1", declined: true })];
    show(fake({ ...lab, threads }), "/a/farmers/chat/r1/t1");
    expect(await screen.findByText(/This request was declined/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("starts a thread and opens it", async () => {
    const client = fake({ ...lab, threads: [thread({})] });
    show(client, "/a/farmers/chat/r1/threads");
    await userEvent.click(await screen.findByRole("button", { name: "Start a thread" }));
    await userEvent.type(screen.getByLabelText("What is the thread about?"), "Printing");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(client.startThread).toHaveBeenCalledWith("r1", "Printing");
    expect(await screen.findByRole("heading", { name: "Siaya Community Computer Lab" })).toBeInTheDocument();
    expect(client.listMessages).toHaveBeenCalledWith("r1", "t9");
  });

  it("goes back from the threads to General", async () => {
    const client = fake({ ...lab, threads: [thread({ id: "g1" }), thread({ id: "t2", label: "Ask", audience: "leads" })] });
    show(client, "/a/farmers/chat/r1/threads");
    await screen.findByText("Ask");
    await userEvent.click(await screen.findByRole("button", { name: "‹ Siaya Community Computer Lab" }));
    expect(client.listMessages).toHaveBeenCalledWith("r1", "g1");
  });
});

describe("a room that cannot load", () => {
  it("announces The room could not be loaded. in the failure card when the messages cannot be read", async () => {
    show({ ...fake({}), listMessages: vi.fn().mockRejectedValue(new Error("down")) }, "/a/farmers/chat/r1/t1");
    await act(async () => undefined);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The room could not be loaded.");
    expect(alert.closest(".card")).toHaveClass("empty");
  });

  it("announces nothing when the messages are read", async () => {
    show(fake({ messages: [message({ body: "hello" })] }), "/a/farmers/chat/r1/t1");
    await screen.findByText("hello");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces The threads could not be loaded. and offers no new thread when the threads cannot be read", async () => {
    show({ ...fake({}), listThreads: vi.fn().mockRejectedValue(new Error("down")) }, "/a/farmers/chat/r1/threads");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The threads could not be loaded.");
    expect(alert.closest(".card")).toHaveClass("empty");
    expect(screen.queryByRole("button", { name: "Start a thread" })).toBeNull();
  });

  it("announces nothing on the threads that are read", async () => {
    show(fake({}), "/a/farmers/chat/r1/threads");
    await screen.findByRole("button", { name: "Start a thread" });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
