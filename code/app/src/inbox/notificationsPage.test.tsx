import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { StartClient, StartStep } from "../coordinator/start/api";
import { NotificationsPage } from "../pages/NotificationsPage";
import type { InboxClient, InvitationItem, NotificationItem } from "./api";
import type { Reader } from "./subjectCheck";

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

const assigned = (over: Partial<NotificationItem> = {}) => note({ id: "a1", event: "task_assigned", subjectKind: "task", subjectId: "t1", names: {}, ...over });

const invitation: InvitationItem = { id: "i1", groupName: "Contributors", inviterName: "Grace Adhiambo", expiresInDays: 5 };

const waitingStep = { id: "w1", title: "Confirm the delivery", roleName: "Member", agencyName: "Farmers" } as StartStep;

const fake = (notes: NotificationItem[], invites: InvitationItem[] = []): InboxClient => ({
  listNotifications: vi.fn().mockResolvedValue(notes),
  markRead: vi.fn().mockResolvedValue(notes.length),
  listInvitations: vi.fn().mockResolvedValue(invites),
  acceptInvitation: vi.fn().mockResolvedValue(undefined),
  declineInvitation: vi.fn().mockResolvedValue(undefined),
});

const startWith = (steps: StartStep[] = []) => ({ waiting: async () => steps }) as unknown as StartClient;

const stillThere: Reader = async () => ({ status: "pending" });

const show = (client: InboxClient, start: StartClient = startWith()) =>
  render(
    <MemoryRouter>
      <NotificationsPage client={client} start={start} read={stillThere} />
    </MemoryRouter>,
  );

const heading = (name: string) => screen.findByRole("heading", { level: 2, name });

describe("the Notifications page", () => {
  it("holds Needs you above Updates", async () => {
    show(fake([assigned(), note({})], [invitation]), startWith([waitingStep]));
    const needs = await heading("Needs you");
    const updates = await heading("Updates");
    expect(needs.compareDocumentPosition(updates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("lists the invitation, the waiting step and the assigned issue under Needs you and the news under Updates", async () => {
    show(fake([assigned(), note({})], [invitation]), startWith([waitingStep]));
    const needs = (await heading("Needs you")).nextElementSibling as HTMLElement;
    expect(within(needs).getByText("You are invited to Contributors")).toBeInTheDocument();
    expect(within(needs).getByText("Confirm the delivery")).toBeInTheDocument();
    expect(within(needs).getByText("An issue was assigned to you")).toBeInTheDocument();
    const updates = (await heading("Updates")).closest(".heading-row")?.nextElementSibling as HTMLElement;
    expect(within(updates).getByText("You joined Siaya farmers")).toBeInTheDocument();
    expect(within(updates).queryByText("An issue was assigned to you")).toBeNull();
  });

  it("does not repeat in Updates a notification that announces something under Needs you", async () => {
    show(fake([assigned(), note({})]));
    await heading("Needs you");
    expect(screen.getAllByText("An issue was assigned to you")).toHaveLength(1);
  });

  it("has no Needs you section when nothing waits, and Updates comes first", async () => {
    show(fake([note({})]));
    await heading("Updates");
    expect(screen.queryByRole("heading", { name: "Needs you" })).toBeNull();
  });

  it("has no Updates section when there is no news, and shows no caught up card", async () => {
    show(fake([], [invitation]));
    await heading("Needs you");
    expect(screen.queryByRole("heading", { name: "Updates" })).toBeNull();
    expect(screen.queryByText("You are all caught up")).toBeNull();
  });

  it("says You are all caught up only when both sections are empty", async () => {
    show(fake([]));
    expect(await screen.findByText("You are all caught up")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Needs you" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Updates" })).toBeNull();
  });

  it("puts Mark all read in the Updates heading and marks the updates only", async () => {
    const client = fake([assigned(), note({ id: "u1" }), note({ id: "u2", event: "group_join_declined", subjectKind: "group", names: {} })], [invitation]);
    show(client);
    const updatesHeading = (await heading("Updates")).closest(".heading-row") as HTMLElement;
    await userEvent.click(within(updatesHeading).getByRole("button", { name: "Mark all read" }));
    expect(client.markRead).toHaveBeenCalledWith(["u1", "u2"]);
    expect(screen.getByText("An issue was assigned to you").closest(".row")).not.toBeNull();
    expect(within(screen.getByText("An issue was assigned to you").closest(".row") as HTMLElement).getByLabelText("Unread")).toBeInTheDocument();
  });

  it("has no Mark all read when only Needs you is unread", async () => {
    show(fake([assigned(), note({ read: true })]));
    await heading("Updates");
    expect(screen.queryByRole("button", { name: "Mark all read" })).toBeNull();
  });

  it("turns Mark all read into Mark read for the ticked updates, and Needs you rows have no box", async () => {
    const client = fake([assigned(), note({ id: "u1" }), note({ id: "u2", event: "group_join_declined", names: {} })]);
    show(client);
    await heading("Updates");
    const needsRow = screen.getByText("An issue was assigned to you").closest(".row") as HTMLElement;
    expect(needsRow.closest(".selrow")).toBeNull();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select You joined Siaya farmers" }));
    await userEvent.click(screen.getByRole("button", { name: "Mark read" }));
    expect(client.markRead).toHaveBeenCalledWith(["u1"]);
  });

  it("opens a Needs you notification at its screen and marks only that one read", async () => {
    const client = fake([assigned()]);
    show(client);
    await userEvent.click(await screen.findByRole("button", { name: /An issue was assigned to you/ }));
    await waitFor(() => expect(client.markRead).toHaveBeenCalledWith(["a1"]));
  });
});
