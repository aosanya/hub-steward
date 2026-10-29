import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { AskPage } from "../pages/chat/AskPage";
import { ChatPage } from "../pages/chat/ChatPage";
import { routes } from "../routes";
import { unreadLabel } from "./unread";
import type { Ask, ChatClient, ChatMessage } from "./api";

const askMessage: ChatMessage = {
  id: "m1",
  author: "Suppliers' agent",
  agent: true,
  body: "Asha Otieno asks: 2 bags of urea by Friday, 6 Nov. Your list: 40 bags. Already promised: 2.",
  at: "2026-10-28T09:05:00Z",
  askId: "a1",
  mine: false,
};

const ask: Ask = { id: "a1", asker: "Asha Otieno", question: "2 bags of urea by Friday, 6 Nov", answer: "waiting", detail: "" };

const todayAt = (hours: number, minutes: number) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

const fake = (messages: ChatMessage[]): ChatClient => ({
  listRooms: vi.fn().mockResolvedValue([{ id: "s1", name: "Kisumu Agro Supplies", threadId: "t1", threadName: "Suppliers", unread: 0 }]),
  listMessages: vi.fn().mockResolvedValue(messages),
  getAsk: vi.fn().mockResolvedValue(ask),
  answerAsk: vi.fn().mockResolvedValue(undefined),
});

const Opened = () => {
  const { roomId, threadId } = useParams();
  return <p>{`room ${roomId} thread ${threadId}`}</p>;
};

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const show = (client: ChatClient, entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/chat" element={<ChatPage client={client} />} />
        <Route path={routes.roomThread.pattern} element={<Opened />} />
        <Route path={routes.ask.pattern} element={<AskPage client={client} />} />
        <Route path={routes.join.pattern} element={<p>Join page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("chat and the suppliers room", () => {
  it("lists the rooms and opens one", async () => {
    show(fake([askMessage]), "/chat");
    await userEvent.click(await screen.findByRole("button", { name: /Kisumu Agro Supplies/ }));
    expect(await screen.findByText("room s1 thread t1")).toBeInTheDocument();
  });

  it("answers No without a date", async () => {
    const client = fake([askMessage]);
    show(client, "/a/farmers/chat/s1/t1/asks/a1");
    await userEvent.click(await screen.findByRole("button", { name: "No" }));
    expect(client.answerAsk).toHaveBeenCalledWith("a1", { answer: "no" });
  });

  it("answers only when he presses Yes on the ask page", async () => {
    const client = fake([askMessage]);
    show(client, "/a/farmers/chat/s1/t1/asks/a1");
    await screen.findByText("Asha Otieno");
    expect(client.answerAsk).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(client.answerAsk).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Date"), "2026-11-06");
    await userEvent.type(screen.getByLabelText("Note"), "On the lorry");
    await userEvent.click(screen.getByRole("button", { name: "Send yes" }));
    expect(client.answerAsk).toHaveBeenCalledWith("a1", { answer: "yes", date: "2026-11-06", note: "On the lorry" });
    expect(screen.getByText("You said yes.")).toBeInTheDocument();
  });
});

describe("unread on the rooms list", () => {
  it("labels none, one, ninety-nine and more", () => {
    expect(unreadLabel(undefined)).toBe("");
    expect(unreadLabel(0)).toBe("");
    expect(unreadLabel(1)).toBe("1");
    expect(unreadLabel(99)).toBe("99");
    expect(unreadLabel(100)).toBe("99+");
    expect(unreadLabel(5000)).toBe("99+");
  });

  it("shows each room's count and 99+ for the capped one", async () => {
    const client = fake([]);
    client.listRooms = vi.fn().mockResolvedValue([
      { id: "s1", name: "Siaya farmers", threadId: "t1", threadName: "Farmers", unread: 2 },
      { id: "s2", name: "Kisumu Agro Supplies", threadId: "t2", threadName: "Suppliers", unread: 100 },
      { id: "s3", name: "Siaya Boda Boda Riders", threadId: "t3", threadName: "Riders", unread: 0 },
    ]);
    show(client, "/chat");
    expect(await screen.findByLabelText("2 unread")).toHaveTextContent("2");
    expect(screen.getByLabelText("99+ unread")).toHaveTextContent("99+");
    expect(screen.getAllByLabelText(/unread$/)).toHaveLength(2);
  });

  it("leaves the chevron of a room with nothing new out of its name", async () => {
    const client = fake([]);
    client.listRooms = vi.fn().mockResolvedValue([{ id: "s3", name: "Siaya Boda Boda Riders", threadId: "t3", threadName: "Riders", unread: 0 }]);
    show(client, "/chat");
    expect(await screen.findByRole("button", { name: "Siaya Boda Boda Riders Riders" })).toBeInTheDocument();
  });
});

describe("the last message on each room row", () => {
  const rooms = (list: object[]) => {
    const client = fake([]);
    client.listRooms = vi.fn().mockResolvedValue(list);
    return client;
  };

  it("shows the preview and the time of the latest message", async () => {
    show(
      rooms([{ id: "s1", name: "Siaya farmers", threadId: "t1", threadName: "Farmers", unread: 0, preview: "Grace Adhiambo: I started a group order for urea.", lastAt: todayAt(9, 30) }]),
      "/chat",
    );
    expect(await screen.findByText("Grace Adhiambo: I started a group order for urea.")).toBeInTheDocument();
    expect(screen.getByText("09:30")).toBeInTheDocument();
  });

  it("shows the weekday and date for a message from another day", async () => {
    show(
      rooms([{ id: "s1", name: "Siaya farmers", threadId: "t1", threadName: "Farmers", unread: 0, preview: "Old news", lastAt: "2020-03-04T12:00:00" }]),
      "/chat",
    );
    expect(await screen.findByText("Wed 4 Mar")).toBeInTheDocument();
  });

  it("shows the time and the unread count together", async () => {
    show(
      rooms([{ id: "s1", name: "Suppliers", threadId: "t1", threadName: "Suppliers", unread: 1, preview: "Suppliers' agent: Asha Otieno asks for 2 bags of urea.", lastAt: todayAt(9, 5) }]),
      "/chat",
    );
    expect(await screen.findByText("09:05")).toBeInTheDocument();
    expect(screen.getByLabelText("1 unread")).toBeInTheDocument();
  });

  it("falls back to the thread name when nobody has posted", async () => {
    show(rooms([{ id: "s1", name: "Siaya farmers", threadId: "t1", threadName: "Farmers", unread: 0 }]), "/chat");
    expect(await screen.findByText("Farmers")).toBeInTheDocument();
    expect(screen.queryByText(/^\d\d:\d\d$/)).toBeNull();
  });
});

describe("the empty Chat tab and Join a group", () => {
  it("says there are no rooms and still offers Join a group", async () => {
    const client = fake([]);
    client.listRooms = vi.fn().mockResolvedValue([]);
    show(client, "/chat");
    expect(await screen.findByText("No rooms yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join a group" })).toBeInTheDocument();
  });

  it("puts Join a group in the app bar, not the page body", async () => {
    const client = fake([]);
    client.listRooms = vi.fn().mockResolvedValue([]);
    show(client, "/chat");
    await screen.findByText("No rooms yet.");
    expect(screen.getByRole("banner")).toContainElement(screen.getByRole("button", { name: "Join a group" }));
  });

  it("draws a lead letter from the group name and clips the preview by class", async () => {
    const client = fake([]);
    client.listRooms = vi.fn().mockResolvedValue([{ id: "s1", name: "siaya farmers", threadId: "t1", threadName: "Farmers", unread: 0, preview: "Hello" }]);
    const { container } = show(client, "/chat");
    await screen.findByText("Hello");
    expect(container.querySelector(".row.room .lead")?.textContent).toBe("S");
  });

  it("opens the join page from Join a group on a list with rooms", async () => {
    show(fake([]), "/chat");
    await screen.findByText("Suppliers");
    await userEvent.click(screen.getByRole("button", { name: "Join a group" }));
    expect(await screen.findByText("Join page")).toBeInTheDocument();
  });

  it("offers Join a group when chat could not be loaded", async () => {
    const client = fake([]);
    client.listRooms = vi.fn().mockRejectedValue(new Error("down"));
    show(client, "/chat");
    expect(await screen.findByText("Chat could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join a group" })).toBeInTheDocument();
  });
});
