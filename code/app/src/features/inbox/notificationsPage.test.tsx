import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import type { StartClient, StartStep } from "../market";
import { NotificationsPage } from "./NotificationsPage";
import type { InboxClient, InvitationItem, NotificationItem } from "./api";
import type { AssignedClient } from "./assignedIssues";
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

const show = (client: InboxClient, start: StartClient = startWith(), assigned?: AssignedClient) =>
  render(
    <MemoryRouter>
      <NotificationsPage client={client} start={start} assigned={assigned} read={stillThere} />
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
    show(client, startWith(), { assigned: () => Promise.reject(new Error("issues unavailable")) });
    const markAll = await screen.findByRole("button", { name: "Mark all read" });
    expect(within(markAll.closest(".heading-row") as HTMLElement).getByRole("heading", { level: 2, name: "Updates" })).toBeInTheDocument();
    await userEvent.click(markAll);
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

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const frame = () => document.querySelector(".wf") as HTMLElement | null;

describe("the Notifications page in the Folders frame", () => {
  afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

  it("puts Needs you in the left pane and Updates under the head strip of the main pane on a wide screen", async () => {
    setWide(true);
    show(fake([assigned(), note({})], [invitation]), startWith([waitingStep]));
    await heading("Needs you");
    await heading("Updates");

    const tree = frame()?.querySelector(".wf-panes > .wf-tree") as HTMLElement;
    const main = frame()?.querySelector(".wf-panes > .wf-main") as HTMLElement;
    expect(within(tree).getByRole("heading", { level: 2, name: "Needs you" })).toBeInTheDocument();
    expect(within(tree).getByText("You are invited to Contributors")).toBeInTheDocument();
    expect(within(main.querySelector(".wf-head") as HTMLElement).getByText("Notifications")).toBeInTheDocument();
    expect(within(main.querySelector(".wf-content") as HTMLElement).getByRole("heading", { level: 2, name: "Updates" })).toBeInTheDocument();
    expect(within(main).getByText("You joined Siaya farmers")).toBeInTheDocument();
  });

  it("keeps the tab bar and its Notifications count on a wide screen", async () => {
    setWide(true);
    show(fake([assigned(), note({})], [invitation]));
    await heading("Needs you");

    expect(frame()).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("draws no frame on a phone and keeps Needs you above Updates", async () => {
    setWide(false);
    show(fake([assigned(), note({})], [invitation]));
    await heading("Needs you");
    await heading("Updates");

    expect(frame()).toBeNull();
  });

  it.each([true, false])("marks read the update about a task that is done and keeps Mark all read when wide is %s", async (wide) => {
    setWide(wide);
    const client = fake([assigned(), note({ id: "u1" })], [invitation]);
    const done: Reader = async () => ({ status: "completed" });
    render(
      <MemoryRouter>
        <NotificationsPage client={client} start={startWith()} read={done} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(client.markRead).toHaveBeenCalledWith(["a1"]));
    expect(await screen.findByRole("button", { name: "Mark all read" })).toBeInTheDocument();
  });

  it("says You are all caught up inside the main pane on a wide screen", async () => {
    setWide(true);
    show(fake([]));

    const card = await screen.findByText("You are all caught up");
    expect(card.closest(".wf-main")).not.toBeNull();
  });
});
