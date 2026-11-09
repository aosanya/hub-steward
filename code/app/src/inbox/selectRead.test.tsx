import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { StartClient } from "../coordinator/start/api";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { InboxPage } from "../pages/InboxPage";
import { routes } from "../routes";
import type { InboxClient, NotificationItem } from "./api";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const reply = (id: string, over: Partial<NotificationItem> = {}): NotificationItem => ({
  id,
  event: "thread_reply",
  subjectKind: "chat_thread",
  subjectId: `thread-${id}`,
  structureId: "room-1",
  names: {},
  createdAt: "2026-10-28T10:40:00Z",
  read: false,
  ...over,
});

const fake = (notes: NotificationItem[]): InboxClient => ({
  listNotifications: vi.fn().mockResolvedValue(notes),
  markRead: vi.fn().mockResolvedValue(notes.length),
  listInvitations: vi.fn().mockResolvedValue([]),
  acceptInvitation: vi.fn().mockResolvedValue(undefined),
  declineInvitation: vi.fn().mockResolvedValue(undefined),
});

const quietStart = { waiting: async () => [] } as unknown as StartClient;

const show = (client: InboxClient) =>
  render(
    <MemoryRouter initialEntries={["/inbox"]}>
      <Routes>
        <Route path="/inbox" element={<InboxPage client={client} start={quietStart} />} />
        <Route path={routes.roomThread.pattern} element={<p>the thread opened</p>} />
      </Routes>
    </MemoryRouter>,
  );

const boxes = () => screen.getAllByRole("checkbox");

describe("selecting rows to mark read", () => {
  it("shows a checkbox on every unread row and starts with Mark all read", async () => {
    show(fake([reply("c1"), reply("c2"), reply("c3", { read: true })]));
    await screen.findByRole("button", { name: "Mark all read" });
    expect(boxes()).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Mark read" })).toBeNull();
  });

  it("turns Mark all read into Mark read once a row is ticked and back when it is unticked", async () => {
    show(fake([reply("c1"), reply("c2")]));
    await screen.findByRole("button", { name: "Mark all read" });
    await userEvent.click(boxes()[0]);
    expect(screen.getByRole("button", { name: "Mark read" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark all read" })).toBeNull();
    await userEvent.click(boxes()[0]);
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeInTheDocument();
  });

  it("marks exactly the ticked rows read and goes back to Mark all read", async () => {
    const client = fake([reply("c1"), reply("c2"), reply("c3")]);
    show(client);
    await screen.findByRole("button", { name: "Mark all read" });
    await userEvent.click(boxes()[0]);
    await userEvent.click(boxes()[2]);
    await userEvent.click(screen.getByRole("button", { name: "Mark read" }));
    expect(client.markRead).toHaveBeenCalledTimes(1);
    expect(client.markRead).toHaveBeenCalledWith(["c1", "c3"]);
    expect(await screen.findByLabelText("1 unread notifications")).toBeInTheDocument();
    expect(boxes()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeInTheDocument();
  });

  it("keeps the selection and says so when the call fails", async () => {
    const client = fake([reply("c1"), reply("c2")]);
    client.markRead = vi.fn().mockRejectedValue(new Error("down"));
    show(client);
    await screen.findByRole("button", { name: "Mark all read" });
    await userEvent.click(boxes()[0]);
    await userEvent.click(screen.getByRole("button", { name: "Mark read" }));
    expect(await screen.findByText("Could not mark the notifications read. Try again.")).toBeInTheDocument();
    expect(boxes()[0]).toBeChecked();
    expect(screen.getByRole("button", { name: "Mark read" })).toBeInTheDocument();
  });

  it("still opens the row when it is tapped, and ticking does not open it", async () => {
    const client = fake([reply("c1"), reply("c2")]);
    show(client);
    await screen.findByRole("button", { name: "Mark all read" });
    await userEvent.click(boxes()[0]);
    expect(screen.queryByText("the thread opened")).toBeNull();
    expect(client.markRead).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole("button", { name: /There is a new reply/ })[1]);
    expect(await screen.findByText("the thread opened")).toBeInTheDocument();
    expect(client.markRead).toHaveBeenCalledWith(["c2"]);
  });
});
