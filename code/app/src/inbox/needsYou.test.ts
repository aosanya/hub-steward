import type { StartStep } from "../coordinator/start/api";
import type { InvitationItem, NotificationItem } from "./api";
import { needsYouCount, updatesOf, waitingStepsOf } from "./needsYou";

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

describe("the things waiting on the member", () => {
  it("counts steps, invitations, and unread asks, forms, drafts and assigned issues together", () => {
    const count = needsYouCount({
      steps: [step("s1")],
      invitations: [invitation("i1"), invitation("i2")],
      items: [note("a", "ask_waiting"), note("b", "new_form"), note("c", "draft_waiting"), note("d", "task_assigned")],
    });
    expect(count).toBe(7);
  });

  it("does not count the Create group order step, which can always be started", () => {
    expect(waitingStepsOf([step("s1", "Create group order"), step("s2")]).map((s) => s.id)).toEqual(["s2"]);
    expect(needsYouCount({ steps: [step("s1", "Create group order")], invitations: [], items: [] })).toBe(0);
  });

  it("does not count news, read or unread", () => {
    expect(needsYouCount({ steps: [], invitations: [], items: [note("a", "results_published"), note("b", "group_order_called_off"), note("c", "notice_posted", true)] })).toBe(0);
  });

  it("does not count a notification that announces an invitation, the invitation is counted itself", () => {
    expect(needsYouCount({ steps: [], invitations: [invitation("i1")], items: [note("a", "group_invited")] })).toBe(1);
  });

  it("counts a notification that announces a task only until it is read", () => {
    expect(needsYouCount({ steps: [], invitations: [], items: [note("a", "task_assigned", true)] })).toBe(0);
  });
});

describe("the Updates", () => {
  it("leave out what announces a thing waiting, an invitation included, and keep the news", () => {
    const kept = updatesOf([note("a", "ask_waiting"), note("b", "group_invited"), note("c", "results_published"), note("d", "group_join_approved", true)]);
    expect(kept.map((n) => n.id)).toEqual(["c", "d"]);
  });
});
