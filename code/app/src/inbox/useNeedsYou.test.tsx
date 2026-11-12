import { act, renderHook, waitFor } from "@testing-library/react";
import type { StartClient, StartStep } from "../coordinator/start/api";
import type { InboxClient, InvitationItem, NotificationItem } from "./api";
import type { AssignedClient, AssignedIssue } from "./assignedIssues";
import { useNeedsYou } from "./useNeedsYou";

const note = (id: string, event: string, read = false): NotificationItem => ({
  id,
  event,
  subjectKind: "",
  subjectId: "",
  names: {},
  createdAt: "2026-11-12T10:00:00Z",
  read,
});

const step = (id: string): StartStep => ({ id, title: id, formName: "Harvest report", roleName: "", workflowName: "", agencyName: "", questions: [] });

const invitation = (id: string): InvitationItem => ({ id, groupName: "Kisumu", inviterName: "Amina", expiresInDays: 3 });

const inboxOf = (notes: NotificationItem[], invitations: InvitationItem[] = []): InboxClient => ({
  listNotifications: vi.fn().mockResolvedValue(notes),
  markRead: vi.fn().mockResolvedValue(notes.length),
  listInvitations: vi.fn().mockResolvedValue(invitations),
  acceptInvitation: vi.fn().mockResolvedValue(undefined),
  declineInvitation: vi.fn().mockResolvedValue(undefined),
});

const startOf = (steps: StartStep[]) => ({ waiting: vi.fn().mockResolvedValue(steps) }) as unknown as StartClient;

const issue = (id: string): AssignedIssue => ({ id, code: id, title: id, step: "to-do" });

const assignedOf = (issues: AssignedIssue[]): AssignedClient => ({ assigned: vi.fn().mockResolvedValue(issues) });

const quiet = assignedOf([]);

const regainFocus = () => act(async () => void window.dispatchEvent(new Event("focus")));

describe("useNeedsYou", () => {
  it("has no count until every read has answered", async () => {
    const inbox = inboxOf([note("a", "ask_waiting")]);
    const start = startOf([step("s1")]);
    const { result } = renderHook(() => useNeedsYou(inbox, start, quiet));
    expect(result.current.count).toBeNull();
    await waitFor(() => expect(result.current.count).toBe(2));
  });

  it("counts steps, invitations and unread things waiting, and flags unread news as a dot, not a number", async () => {
    const inbox = inboxOf([note("a", "ask_waiting"), note("b", "results_published")], [invitation("i1")]);
    const start = startOf([step("s1")]);
    const { result } = renderHook(() => useNeedsYou(inbox, start, quiet));
    await waitFor(() => expect(result.current.count).toBe(3));
    expect(result.current.newsUnread).toBe(true);
  });

  it("has no news dot when all news is read or there is none", async () => {
    const inbox = inboxOf([note("a", "results_published", true), note("b", "ask_waiting")]);
    const start = startOf([]);
    const { result } = renderHook(() => useNeedsYou(inbox, start, quiet));
    await waitFor(() => expect(result.current.count).toBe(1));
    expect(result.current.newsUnread).toBe(false);
  });

  it("shows no number, not 0, when the notifications cannot be read", async () => {
    const inbox = inboxOf([]);
    inbox.listNotifications = vi.fn().mockRejectedValue(new Error("down"));
    const start = startOf([step("s1")]);
    const { result } = renderHook(() => useNeedsYou(inbox, start, quiet));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.count).toBeNull();
  });

  it("shows no number, not 0, when the invitations cannot be read", async () => {
    const inbox = inboxOf([]);
    inbox.listInvitations = vi.fn().mockRejectedValue(new Error("down"));
    const start = startOf([]);
    const { result } = renderHook(() => useNeedsYou(inbox, start, quiet));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.count).toBeNull();
  });

  it("shows no number, not 0, when the waiting steps cannot be read", async () => {
    const start = { waiting: vi.fn().mockRejectedValue(new Error("down")) } as unknown as StartClient;
    const inbox = inboxOf([]);
    const { result } = renderHook(() => useNeedsYou(inbox, start, quiet));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.count).toBeNull();
  });

  it("reads everything again when the app regains focus and shows the new number", async () => {
    const inbox = inboxOf([]);
    const start = startOf([]);
    const { result } = renderHook(() => useNeedsYou(inbox, start, quiet));
    await waitFor(() => expect(result.current.count).toBe(0));
    inbox.listNotifications = vi.fn().mockResolvedValue([note("a", "task_assigned")]);
    inbox.listInvitations = vi.fn().mockResolvedValue([invitation("i1")]);
    start.waiting = vi.fn().mockResolvedValue([step("s1")]);
    await regainFocus();
    await waitFor(() => expect(result.current.count).toBe(3));
  });

  it("reads once per source for two readers on one focus", async () => {
    const inbox = inboxOf([]);
    const start = startOf([]);
    const a = renderHook(() => useNeedsYou(inbox, start, quiet));
    const b = renderHook(() => useNeedsYou(inbox, start, quiet));
    await waitFor(() => expect(a.result.current.count).toBe(0));
    await waitFor(() => expect(b.result.current.count).toBe(0));
    await regainFocus();
    await waitFor(() => expect(inbox.listNotifications).toHaveBeenCalledTimes(2));
    expect(inbox.listInvitations).toHaveBeenCalledTimes(2);
    expect(start.waiting).toHaveBeenCalledTimes(2);
  });

  it("drops the number after a failed refresh and brings it back after the next good one", async () => {
    const inbox = inboxOf([note("a", "ask_waiting")]);
    const start = startOf([]);
    const { result } = renderHook(() => useNeedsYou(inbox, start, quiet));
    await waitFor(() => expect(result.current.count).toBe(1));
    inbox.listNotifications = vi.fn().mockRejectedValue(new Error("down"));
    await regainFocus();
    await waitFor(() => expect(result.current.count).toBeNull());
    inbox.listNotifications = vi.fn().mockResolvedValue([note("a", "ask_waiting"), note("b", "ask_waiting")]);
    await regainFocus();
    await waitFor(() => expect(result.current.count).toBe(2));
  });

  it("counts each assigned issue once, and not the notification that announces it", async () => {
    const inbox = inboxOf([{ ...note("a", "task_assigned"), subjectId: "t1" }, { ...note("b", "task_assigned"), subjectId: "t2" }, note("c", "ask_waiting")]);
    const assigned = assignedOf([issue("t1"), issue("t2")]);
    const start = startOf([]);
    const { result } = renderHook(() => useNeedsYou(inbox, start, assigned));
    await waitFor(() => expect(result.current.count).toBe(3));
  });

  it("has no count while the assigned issues have not answered", async () => {
    const pending: AssignedClient = { assigned: () => new Promise<AssignedIssue[]>(() => undefined) };
    const inbox = inboxOf([note("a", "ask_waiting")]);
    const start = startOf([]);
    const { result } = renderHook(() => useNeedsYou(inbox, start, pending));
    await waitFor(() => expect(inbox.listNotifications).toHaveBeenCalled());
    expect(result.current.count).toBeNull();
  });

  it("counts the notification that announces an issue when the assigned issues cannot be read", async () => {
    const failing: AssignedClient = { assigned: vi.fn().mockRejectedValue(new Error("down")) };
    const inbox = inboxOf([note("a", "task_assigned")]);
    const start = startOf([]);
    const { result } = renderHook(() => useNeedsYou(inbox, start, failing));
    await waitFor(() => expect(result.current.count).toBe(1));
  });

  it("reads the assigned issues again when the app regains focus", async () => {
    const assigned = assignedOf([]);
    const inbox = inboxOf([]);
    const start = startOf([]);
    const { result } = renderHook(() => useNeedsYou(inbox, start, assigned));
    await waitFor(() => expect(result.current.count).toBe(0));
    assigned.assigned = vi.fn().mockResolvedValue([issue("t1")]);
    await regainFocus();
    await waitFor(() => expect(result.current.count).toBe(1));
  });
});
