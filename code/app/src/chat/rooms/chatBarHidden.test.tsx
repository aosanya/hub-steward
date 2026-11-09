import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../agency/open";
import { AskPage } from "../../pages/chat/AskPage";
import { ChatPage } from "../../pages/chat/ChatPage";
import { routes } from "../../routes";
import type { ChatClient } from "../api";
import type { RoomsClient } from "./api";
import { RoomThreadPage } from "./RoomThreadPage";
import { RoomThreadsPage } from "./RoomThreadsPage";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const rooms = {
  subject: async () => "me",
  roomName: async () => "Siaya farmers",
  listThreads: async () => [{ id: "t1", label: "General", audience: "group", requestedBy: "", declined: false, unread: 0, lastMessageAt: "", preview: "" }],
  listMessages: async () => [],
  post: async () => undefined,
  startThread: async () => "t2",
} as unknown as RoomsClient;

const chat = {
  listRooms: async () => [{ id: "r1", name: "Siaya farmers", threadId: "t1", threadName: "General", unread: 0 }],
  getAsk: async () => ({ id: "a1", asker: "Asha", question: "2 bags of urea", answer: "waiting", detail: "" }),
  answerAsk: async () => undefined,
} as unknown as ChatClient;

const show = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/a/:agencyId/chat" element={<ChatPage client={chat} />} />
        <Route path={routes.roomThreads.pattern} element={<RoomThreadsPage client={rooms} />} />
        <Route path={routes.roomThread.pattern} element={<RoomThreadPage client={rooms} heading="thread" />} />
        <Route path={routes.ask.pattern} element={<AskPage client={chat} />} />
      </Routes>
    </MemoryRouter>,
  );

const mainBar = () => screen.queryByRole("navigation", { name: "Main" });

describe("an open chat hides the bottom bar (D50)", () => {
  it("hides it on a thread", async () => {
    show("/a/farmers/chat/r1/t1");
    await screen.findByRole("button", { name: /Threads/ });
    expect(mainBar()).toBeNull();
  });

  it("hides it on the list of threads on top of the chat", async () => {
    show("/a/farmers/chat/r1/threads");
    await screen.findByText("General");
    expect(mainBar()).toBeNull();
  });

  it("hides it on an ask opened from the chat", async () => {
    show("/a/farmers/chat/r1/t1/asks/a1");
    await screen.findByText(/2 bags of urea/);
    expect(mainBar()).toBeNull();
  });

  it("keeps it on the list of chats", async () => {
    show("/a/farmers/chat");
    await screen.findByText("Siaya farmers");
    expect(mainBar()).not.toBeNull();
  });
});
