import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { StartClient, StartStep } from "../coordinator/start/api";
import { NotificationsPage } from "../pages/NotificationsPage";
import type { InboxClient, InvitationItem, NotificationItem } from "./api";
import type { AssignedClient, AssignedIssue } from "./assignedIssues";
import type { Reader } from "./subjectCheck";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const news: NotificationItem = {
  id: "n1",
  event: "joined",
  subjectKind: "group",
  subjectId: "g1",
  names: { group: "Siaya farmers" },
  createdAt: "2026-10-28T10:40:00Z",
  read: false,
};
const invitation: InvitationItem = { id: "i1", groupName: "Contributors", inviterName: "Grace Adhiambo", expiresInDays: 5 };
const waitingStep = { id: "w1", title: "Confirm the delivery", roleName: "Member", agencyName: "Farmers" } as StartStep;
const issue: AssignedIssue = { id: "x1", code: "ISS-9", title: "Fix the gate", step: "to-do" };

const refused = () => new Error("forbidden");
const never = () => new Promise<never>(() => undefined);

const inbox = (over: Partial<InboxClient> = {}): InboxClient => ({
  listNotifications: vi.fn().mockResolvedValue([]),
  markRead: vi.fn().mockResolvedValue(0),
  listInvitations: vi.fn().mockResolvedValue([]),
  acceptInvitation: vi.fn().mockResolvedValue(undefined),
  declineInvitation: vi.fn().mockResolvedValue(undefined),
  ...over,
});
const startWith = (waiting: () => Promise<StartStep[]> = async () => []) => ({ waiting: vi.fn(waiting) }) as unknown as StartClient & { waiting: ReturnType<typeof vi.fn> };
const assignedWith = (assigned: () => Promise<AssignedIssue[]> = async () => []) => ({ assigned: vi.fn(assigned) }) as AssignedClient & { assigned: ReturnType<typeof vi.fn> };
const stillThere: Reader = async () => ({ status: "pending" });

const show = (client: InboxClient, start: StartClient = startWith(), assigned: AssignedClient = assignedWith()) =>
  render(
    <MemoryRouter>
      <NotificationsPage client={client} start={start} assigned={assigned} read={stillThere} />
    </MemoryRouter>,
  );

describe("a section says where it stands", () => {
  it("says Loading in both sections while every read is out and never You are all caught up", async () => {
    show(inbox({ listNotifications: never, listInvitations: never }), startWith(never), assignedWith(never));
    expect(await screen.findByText("Loading Needs you")).toBeInTheDocument();
    expect(await screen.findByText("Loading Updates")).toBeInTheDocument();
    expect(screen.queryByText("You are all caught up")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps Needs you loading while one of its reads is still out, and says nothing is caught up", async () => {
    show(inbox(), startWith(), assignedWith(never));
    expect(await screen.findByText("Loading Needs you")).toBeInTheDocument();
    expect(screen.queryByText("You are all caught up")).toBeNull();
  });

  it("says You are all caught up only after every source answered", async () => {
    show(inbox(), startWith(), assignedWith());
    expect(await screen.findByText("You are all caught up")).toBeInTheDocument();
    expect(screen.queryByText(/Loading/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says Needs you and Updates could not be loaded, each with Try again, when the notification read is refused", async () => {
    show(inbox({ listNotifications: vi.fn().mockRejectedValue(refused()) }));
    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    expect(screen.getByText("Needs you could not be loaded.")).toBeInTheDocument();
    expect(screen.getByText("Updates could not be loaded.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(2);
    expect(screen.queryByText("You are all caught up")).toBeNull();
  });

  it("Try again on Updates re-reads the notifications and fills the section", async () => {
    const list = vi.fn().mockRejectedValueOnce(refused()).mockResolvedValue([news]);
    show(inbox({ listNotifications: list }));
    await screen.findByText("Updates could not be loaded.");
    await userEvent.click(screen.getAllByRole("button", { name: "Try again" })[1]);
    expect(await screen.findByText(/Siaya farmers/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("Try again on Needs you re-reads waiting steps, invitations, assigned issues and notifications", async () => {
    const start = startWith();
    const assigned = assignedWith();
    const client = inbox({ listNotifications: vi.fn().mockRejectedValueOnce(refused()).mockResolvedValue([]) });
    show(client, start, assigned);
    await screen.findByText("Needs you could not be loaded.");
    const invitationReadsBefore = (client.listInvitations as ReturnType<typeof vi.fn>).mock.calls.length;
    await userEvent.click(screen.getAllByRole("button", { name: "Try again" })[0]);
    expect(await screen.findByText("You are all caught up")).toBeInTheDocument();
    expect(start.waiting).toHaveBeenCalledTimes(2);
    expect(assigned.assigned).toHaveBeenCalledTimes(2);
    expect((client.listInvitations as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(invitationReadsBefore);
    expect(client.listNotifications).toHaveBeenCalledTimes(2);
  });

  it("keeps the invitation and says which part failed when the waiting steps cannot be read", async () => {
    show(inbox({ listInvitations: vi.fn().mockResolvedValue([invitation]) }), startWith(async () => Promise.reject(refused())));
    expect(await screen.findByText("You are invited to Contributors")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Needs you could not load your tasks.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("You are all caught up")).toBeNull();
  });

  it("keeps the waiting step and says which part failed when the invitations cannot be read", async () => {
    show(inbox({ listInvitations: vi.fn().mockRejectedValue(refused()) }), startWith(async () => [waitingStep]));
    expect(await screen.findByText("Confirm the delivery")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Needs you could not load your invitations.");
  });

  it("keeps the other rows and says which part failed when the assigned issues cannot be read", async () => {
    show(inbox({ listInvitations: vi.fn().mockResolvedValue([invitation]) }), startWith(), assignedWith(async () => Promise.reject(refused())));
    expect(await screen.findByText("You are invited to Contributors")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Needs you could not load your assigned issues.");
  });

  it("names two failed parts together", async () => {
    show(inbox({ listInvitations: vi.fn().mockRejectedValue(refused()) }), startWith(async () => Promise.reject(refused())), assignedWith(async () => [issue]));
    expect(await screen.findByText("ISS-9 Fix the gate")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Needs you could not load your tasks and your invitations.");
  });

  it("says Needs you could not be loaded, never caught up, when the only read that failed leaves nothing to show", async () => {
    show(inbox(), startWith(), assignedWith(async () => Promise.reject(refused())));
    expect(await screen.findByText("Needs you could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByText("You are all caught up")).toBeNull();
  });

  it("leaves Updates alone when only the waiting steps failed", async () => {
    show(inbox({ listNotifications: vi.fn().mockResolvedValue([news]) }), startWith(async () => Promise.reject(refused())));
    expect(await screen.findByText(/Siaya farmers/)).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText("Updates could not be loaded.")).toBeNull();
  });
});
