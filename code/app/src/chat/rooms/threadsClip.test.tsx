import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RoomThreadsPage } from "./RoomThreadsPage";
import type { RoomsClient } from "./api";
import { routes } from "../../routes";
import { forgetOpenAgency, openAgency } from "../../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const client = {
  subject: async () => "me",
  listThreads: async () => [{ id: "t1", label: "General", audience: "group", requestedBy: "", declined: false, unread: 0, lastMessageAt: "", preview: "" }],
  listMessages: async () => [],
  startThread: async () => "t2",
} as unknown as RoomsClient;

describe("Threads list rows", () => {
  it("clip the second line to one line, as the Chat list does", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/a/farmers/chat/r1/threads"]}>
        <Routes>
          <Route path={routes.roomThreads.pattern} element={<RoomThreadsPage client={client} />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("General");
    expect(container.querySelector("button.row.room")).not.toBeNull();
  });
});
