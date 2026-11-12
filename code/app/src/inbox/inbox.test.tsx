import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { StartClient } from "../coordinator/start/api";
import { InboxPage } from "../pages/InboxPage";
import type { InboxClient, InvitationItem, NotificationItem } from "./api";
import { routes } from "../routes";
import { forgetOpenAgency, openAgency } from "../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const note = (over: Partial<NotificationItem>): NotificationItem => ({
  id: "n1",
  event: "joined",
  subjectKind: "group",
  subjectId: "g1",
  names: { group: "Siaya farmers" },
  createdAt: "2026-10-28T10:40:00Z",
  read: false,
  ...over,
});

const invitation: InvitationItem = { id: "i1", groupName: "Supplier", inviterName: "Grace Adhiambo", expiresInDays: 5 };

const fake = (notes: NotificationItem[], invites: InvitationItem[] = []): InboxClient => ({
  listNotifications: vi.fn().mockResolvedValue(notes),
  markRead: vi.fn().mockResolvedValue(notes.length),
  listInvitations: vi.fn().mockResolvedValue(invites),
  acceptInvitation: vi.fn().mockResolvedValue(undefined),
  declineInvitation: vi.fn().mockResolvedValue(undefined),
});

const quietStart = { waiting: async () => [] } as unknown as StartClient;

const show = (client: InboxClient) =>
  render(
    <MemoryRouter>
      <InboxPage client={client} start={quietStart} />
    </MemoryRouter>,
  );

describe("inbox", () => {
  it("marks unread rows with a dot and leaves read rows without one", async () => {
    show(fake([note({}), note({ id: "n2", event: "new_form", names: {}, read: true })]));
    const unreadRow = (await screen.findByText("You joined Siaya farmers")).closest(".row") as HTMLElement;
    const readRow = screen.getByText("New form").closest(".row") as HTMLElement;
    expect(within(unreadRow).getByLabelText("Unread")).toBeInTheDocument();
    expect(within(readRow).queryByLabelText("Unread")).toBeNull();
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeInTheDocument();
  });

  it("puts the unread dot first in the row, before the title", async () => {
    show(fake([note({}), note({ id: "n2", event: "new_form", names: {}, read: true })]));
    const unreadRow = (await screen.findByText("You joined Siaya farmers")).closest(".row") as HTMLElement;
    expect(unreadRow.firstElementChild).toBe(within(unreadRow).getByLabelText("Unread"));
    expect(unreadRow.lastElementChild).not.toBe(within(unreadRow).getByLabelText("Unread"));
    expect(within(unreadRow).getByText("2026-10-28")).toBeInTheDocument();
  });

  it("puts the unread dot first on an invitation row", async () => {
    show(fake([], [invitation]));
    const row = (await screen.findByText("You are invited to Supplier")).closest(".row") as HTMLElement;
    expect(row.firstElementChild).toBe(within(row).getByLabelText("Unread"));
  });

  it("puts Mark all read in the bar and not in the body", async () => {
    show(fake([note({})]));
    const button = await screen.findByRole("button", { name: "Mark all read" });
    expect(button.closest("header.bar")).not.toBeNull();
    expect(button.closest("main.body")).toBeNull();
  });

  it("has no Mark all read in the bar when nothing is unread", async () => {
    show(fake([note({ read: true })]));
    await screen.findByText("You joined Siaya farmers");
    expect(screen.queryByRole("button", { name: "Mark all read" })).toBeNull();
  });

  it("words the market's four events", async () => {
    show(
      fake([
        note({ id: "m1", event: "supplier_approved", subjectKind: "poster", names: {} }),
        note({ id: "m2", event: "ask_waiting", subjectKind: "ask", names: {} }),
        note({ id: "m3", event: "ask_answered", subjectKind: "ask", names: {} }),
        note({ id: "m4", event: "revision_asked", subjectKind: "group_order", names: {} }),
      ]),
    );
    expect(await screen.findByText("You are approved as a supplier")).toBeInTheDocument();
    expect(screen.getByText("An ask is waiting for your answer")).toBeInTheDocument();
    expect(screen.getByText("Your ask was answered")).toBeInTheDocument();
    expect(screen.getByText("The shop asked to revise the group order")).toBeInTheDocument();
  });

  it("marks everything read through the client", async () => {
    const client = fake([note({})]);
    show(client);
    await userEvent.click(await screen.findByRole("button", { name: "Mark all read" }));
    expect(client.markRead).toHaveBeenCalledWith(["n1"]);
    expect(screen.queryByLabelText("Unread")).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark all read" })).toBeNull();
  });

  it("shows the empty state with its message and no button", async () => {
    show(fake([]));
    expect(await screen.findByText("You are all caught up")).toBeInTheDocument();
    expect(screen.getByText("Notifications from your groups will appear here.")).toBeInTheDocument();
    expect(within(document.querySelector("main.body") as HTMLElement).queryByRole("button")).toBeNull();
  });

  it("opens an invitation and joins it", async () => {
    const client = fake([], [invitation]);
    show(client);
    await userEvent.click(await screen.findByRole("button", { name: /You are invited to Supplier/ }));
    expect(screen.getByText(/Grace Adhiambo invited you to Supplier/)).toBeInTheDocument();
    expect(screen.getByText("Expires in 5 days.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(client.acceptInvitation).toHaveBeenCalledWith("i1");
    expect(screen.getByText("You joined. The group's room is on Chat.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join" })).toBeNull();
  });

  it("says who approved a supplier and for which group when the notice carries the names", async () => {
    show(fake([note({ event: "supplier_approved", names: { person: "Grace Adhiambo", group: "Siaya Farmers' Group" } })]));
    expect(await screen.findByText("You are approved as a supplier")).toBeInTheDocument();
    expect(screen.getByText("Grace Adhiambo · Siaya Farmers' Group")).toBeInTheDocument();
  });

  it("shows the supplier approval alone when the notice carries no names", async () => {
    show(fake([note({ event: "supplier_approved", names: {} })]));
    const row = (await screen.findByText("You are approved as a supplier")).closest(".row") as HTMLElement;
    expect(row.querySelector(".meta")).toBeNull();
  });

  it("falls back to the approver when the person name is an empty string", async () => {
    show(fake([note({ event: "supplier_approved", names: { person: "", approver: "Asha Otieno", group: "", structure: "Siaya Farmers' Group" } })]));
    expect(await screen.findByText("Asha Otieno · Siaya Farmers' Group")).toBeInTheDocument();
  });
  it("words an ask nobody answered with the ask's own line, with no dot because it opens nothing, and marks it read with Mark all read", async () => {
    const client = fake([note({ id: "c1", event: "ask_closed", subjectKind: "ask", names: { line: "a delivery" } })]);
    show(client);
    const row = (await screen.findByText("Nobody answered")).closest(".row") as HTMLElement;
    expect(within(row).getByText("Your ask for a delivery closed.")).toBeInTheDocument();
    expect(within(row).queryByLabelText("Unread")).toBeNull();
    expect(screen.queryByText("ask_closed")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(client.markRead).toHaveBeenCalledWith(["c1"]);
    expect(screen.queryByRole("button", { name: "Mark all read" })).toBeNull();
  });

  it("words a closed ask that carries no line", async () => {
    show(fake([note({ event: "ask_closed", subjectKind: "ask", names: {} })]));
    const row = (await screen.findByText("Nobody answered")).closest(".row") as HTMLElement;
    expect(within(row).getByText("Your ask closed.")).toBeInTheDocument();
  });
});

describe("tapping a row", () => {
  const chatNote = (id: string, over: Partial<NotificationItem> = {}) =>
    note({ id, event: "thread_reply", subjectKind: "chat_thread", subjectId: `thread-${id}`, structureId: "room-1", names: {}, ...over });

  const showWithRoutes = (client: InboxClient) =>
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <Routes>
          <Route path="/inbox" element={<InboxPage client={client} start={quietStart} />} />
          <Route path={routes.roomThread.pattern} element={<p>the thread opened</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it("marks the row read, clears its dot and takes one off the tab", async () => {
    const client = fake([chatNote("c1"), chatNote("c2")]);
    show(client);
    expect(await screen.findByLabelText("2 unread notifications")).toBeInTheDocument();
    const [first] = screen.getAllByRole("button", { name: /There is a new reply/ });
    await userEvent.click(first);
    expect(client.markRead).toHaveBeenCalledWith(["c1"]);
    expect(await screen.findByLabelText("1 unread notifications")).toBeInTheDocument();
    expect(within(first).queryByLabelText("Unread")).toBeNull();
  });

  it("opens the thread and marks only the row that was tapped", async () => {
    const client = fake([chatNote("c1"), chatNote("c2")]);
    showWithRoutes(client);
    await userEvent.click((await screen.findAllByRole("button", { name: /There is a new reply/ }))[1]);
    expect(await screen.findByText("the thread opened")).toBeInTheDocument();
    expect(client.markRead).toHaveBeenCalledTimes(1);
    expect(client.markRead).toHaveBeenCalledWith(["c2"]);
  });

  it("opens the thread all the same when marking it read fails, and leaves the row unread", async () => {
    const client = fake([chatNote("c1")]);
    client.markRead = vi.fn().mockRejectedValue(new Error("down"));
    show(client);
    await userEvent.click(await screen.findByRole("button", { name: /There is a new reply/ }));
    await vi.waitFor(() => expect(client.markRead).toHaveBeenCalled());
    expect(screen.getByLabelText("1 unread notifications")).toBeInTheDocument();
    expect(screen.getByLabelText("Unread")).toBeInTheDocument();
  });

  it("lands in the thread when marking it read fails", async () => {
    const client = fake([chatNote("c1")]);
    client.markRead = vi.fn().mockRejectedValue(new Error("down"));
    showWithRoutes(client);
    await userEvent.click(await screen.findByRole("button", { name: /There is a new reply/ }));
    expect(await screen.findByText("the thread opened")).toBeInTheDocument();
  });

  it("does not ask to mark a row that is already read", async () => {
    const client = fake([chatNote("c1", { read: true })]);
    showWithRoutes(client);
    await userEvent.click(await screen.findByRole("button", { name: /There is a new reply/ }));
    expect(await screen.findByText("the thread opened")).toBeInTheDocument();
    expect(client.markRead).not.toHaveBeenCalled();
  });
});

