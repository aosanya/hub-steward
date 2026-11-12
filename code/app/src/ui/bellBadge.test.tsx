import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { StartClient, StartStep } from "../coordinator/start/api";
import type { InboxClient, InvitationItem, NotificationItem } from "../inbox/api";
import { TabBar } from "./TabBar";

const note = (id: string, event: string, read = false): NotificationItem => ({
  id,
  event,
  subjectKind: "",
  subjectId: "",
  names: {},
  createdAt: "2026-11-12T10:00:00Z",
  read,
});

const step = (id: string, formName = "Harvest report"): StartStep => ({ id, title: id, formName, roleName: "", workflowName: "", agencyName: "", questions: [] });

const invitation = (id: string): InvitationItem => ({ id, groupName: "Kisumu", inviterName: "Amina", expiresInDays: 3 });

const inboxOf = (notes: NotificationItem[], invitations: InvitationItem[] = []): InboxClient => ({
  listNotifications: vi.fn().mockResolvedValue(notes),
  markRead: vi.fn().mockResolvedValue(notes.length),
  listInvitations: vi.fn().mockResolvedValue(invitations),
  acceptInvitation: vi.fn().mockResolvedValue(undefined),
  declineInvitation: vi.fn().mockResolvedValue(undefined),
});

const startOf = (steps: StartStep[]) => ({ waiting: vi.fn().mockResolvedValue(steps) }) as unknown as StartClient;

const bar = (inbox: InboxClient, start: StartClient) =>
  render(
    <MemoryRouter>
      <TabBar inbox={inbox} start={start} />
    </MemoryRouter>,
  );

const bell = () => screen.getByRole("link", { name: /Notifications/ });

describe("the bell on the bar", () => {
  it("shows the number of things waiting on the member", async () => {
    bar(inboxOf([note("a", "ask_waiting")], [invitation("i1")]), startOf([step("s1")]));
    const badge = await screen.findByLabelText("3 things to do");
    expect(badge).toHaveTextContent("3");
    expect(bell()).toContainElement(badge);
  });

  it("does not add unread news to the number", async () => {
    bar(inboxOf([note("a", "ask_waiting"), note("b", "results_published"), note("c", "notice_posted")]), startOf([]));
    expect(await screen.findByLabelText("1 thing to do")).toHaveTextContent("1");
  });

  it("shows unread news as a dot with no number when nothing waits", async () => {
    bar(inboxOf([note("a", "results_published")]), startOf([]));
    const dot = await screen.findByLabelText("New updates");
    expect(dot).toHaveTextContent("");
    expect(bell()).toContainElement(dot);
    expect(screen.queryByLabelText(/things? to do/)).toBeNull();
  });

  it("shows the number and the dot together when both apply", async () => {
    bar(inboxOf([note("a", "ask_waiting"), note("b", "results_published")]), startOf([]));
    expect(await screen.findByLabelText("1 thing to do")).toBeInTheDocument();
    expect(screen.getByLabelText("New updates")).toBeInTheDocument();
  });

  it("shows nothing when nothing waits and the news is read", async () => {
    const inbox = inboxOf([note("a", "results_published", true)]);
    bar(inbox, startOf([]));
    await vi.waitFor(() => expect(inbox.listNotifications).toHaveBeenCalled());
    expect(screen.queryByLabelText(/things? to do|New updates/)).toBeNull();
  });

  it("shows no number while a read has not answered", async () => {
    const start = { waiting: () => new Promise<StartStep[]>(() => undefined) } as unknown as StartClient;
    const inbox = inboxOf([note("a", "ask_waiting")]);
    bar(inbox, start);
    await vi.waitFor(() => expect(inbox.listNotifications).toHaveBeenCalled());
    expect(screen.queryByLabelText(/things? to do/)).toBeNull();
  });

  it("shows no number after a failed read", async () => {
    const inbox = inboxOf([note("a", "ask_waiting")]);
    inbox.listInvitations = vi.fn().mockRejectedValue(new Error("down"));
    bar(inbox, startOf([]));
    await vi.waitFor(() => expect(inbox.listInvitations).toHaveBeenCalled());
    expect(screen.queryByLabelText(/things? to do/)).toBeNull();
  });

  it("does not count the Create group order step", async () => {
    const inbox = inboxOf([]);
    bar(inbox, startOf([step("s1", "Create group order")]));
    await vi.waitFor(() => expect(inbox.listInvitations).toHaveBeenCalled());
    expect(screen.queryByLabelText(/things? to do/)).toBeNull();
  });
});
