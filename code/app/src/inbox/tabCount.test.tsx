import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { StartClient } from "../coordinator/start/api";
import { InboxPage } from "../pages/InboxPage";
import { TabBar } from "../ui/TabBar";
import type { InboxClient, NotificationItem } from "./api";

const note = (id: string, read = false): NotificationItem => ({
  id,
  event: "new_form",
  subjectKind: "form",
  subjectId: "f1",
  names: {},
  createdAt: "2026-10-28T10:40:00Z",
  read,
});

const unreadNotes = (count: number) => Array.from({ length: count }, (_, i) => note(`n${i}`));

const inboxOf = (notes: NotificationItem[]): InboxClient => ({
  listNotifications: vi.fn().mockResolvedValue(notes),
  markRead: vi.fn().mockResolvedValue(notes.length),
  listInvitations: vi.fn().mockResolvedValue([]),
  acceptInvitation: vi.fn().mockResolvedValue(undefined),
  declineInvitation: vi.fn().mockResolvedValue(undefined),
});

const quietStart = { waiting: async () => [] } as unknown as StartClient;

const tabBar = (inbox: InboxClient) =>
  render(
    <MemoryRouter>
      <TabBar inbox={inbox} start={quietStart} />
    </MemoryRouter>,
  );

const notificationsLink = () => screen.getByRole("link", { name: /Notifications/ });

describe("the Notifications tab count", () => {
  it("shows 2 when two notifications are unread", async () => {
    tabBar(inboxOf([note("a"), note("b"), note("c", true)]));
    expect(await screen.findByLabelText("2 unread notifications")).toHaveTextContent("2");
    expect(notificationsLink()).toContainElement(screen.getByLabelText("2 unread notifications"));
  });

  it("shows nothing when everything is read", async () => {
    const inbox = inboxOf([note("a", true)]);
    tabBar(inbox);
    await vi.waitFor(() => expect(inbox.listNotifications).toHaveBeenCalled());
    expect(screen.queryByLabelText(/unread notifications/)).toBeNull();
  });

  it("shows nothing when there are no notifications", async () => {
    const inbox = inboxOf([]);
    tabBar(inbox);
    await vi.waitFor(() => expect(inbox.listNotifications).toHaveBeenCalled());
    expect(screen.queryByLabelText(/unread notifications/)).toBeNull();
  });

  it("shows nothing when the notifications could not be read", async () => {
    const inbox = inboxOf([]);
    inbox.listNotifications = vi.fn().mockRejectedValue(new Error("down"));
    tabBar(inbox);
    await vi.waitFor(() => expect(inbox.listNotifications).toHaveBeenCalled());
    expect(screen.queryByLabelText(/unread notifications/)).toBeNull();
  });

  it("shows 99 for ninety-nine and 99+ above that", async () => {
    const first = tabBar(inboxOf(unreadNotes(99)));
    expect(await screen.findByLabelText("99 unread notifications")).toHaveTextContent("99");
    first.unmount();

    tabBar(inboxOf(unreadNotes(100)));
    expect(await screen.findByLabelText("99+ unread notifications")).toHaveTextContent("99+");
  });

  it("puts the count on only the Notifications tab", async () => {
    tabBar(inboxOf(unreadNotes(2)));
    await screen.findByLabelText("2 unread notifications");
    expect(screen.getAllByLabelText(/unread notifications/)).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Chat/ })).not.toContainElement(screen.getByLabelText("2 unread notifications"));
    expect(screen.getByRole("link", { name: /Home/ })).not.toContainElement(screen.getByLabelText("2 unread notifications"));
  });
});

describe("the Notifications tab count beside the notifications page", () => {
  const openInbox = (inbox: InboxClient) =>
    render(
      <MemoryRouter>
        <InboxPage client={inbox} start={quietStart} />
      </MemoryRouter>,
    );

  it("reads the notifications once for the page and the tab together", async () => {
    const inbox = inboxOf(unreadNotes(2));
    openInbox(inbox);
    expect(await screen.findByLabelText("2 unread notifications")).toBeInTheDocument();
    expect(inbox.listNotifications).toHaveBeenCalledTimes(1);
  });

  it("takes the count off the tab when Mark all read is pressed", async () => {
    const inbox = inboxOf(unreadNotes(2));
    openInbox(inbox);
    await screen.findByLabelText("2 unread notifications");
    await userEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(screen.queryByLabelText(/unread notifications/)).toBeNull();
    expect(inbox.markRead).toHaveBeenCalledWith(["n0", "n1"]);
  });

  it("shows no count on the tab for a page with nothing unread", async () => {
    const inbox = inboxOf([note("a", true)]);
    openInbox(inbox);
    await screen.findByText("New form");
    expect(screen.queryByLabelText(/unread notifications/)).toBeNull();
  });
});
