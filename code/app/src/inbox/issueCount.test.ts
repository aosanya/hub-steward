import { describe, expect, it } from "vitest";
import type { NotificationItem } from "./api";
import { withoutIssueNotices } from "./issueCount";
import { needsYouCount } from "./needsYou";

const note = (id: string, event: string, subjectId = "t1"): NotificationItem => ({ id, event, subjectKind: "issue", subjectId, names: {}, createdAt: "2026-11-12T10:00:00Z", read: false });

const listed = { id: "t1", code: "HS-002", title: "Review", step: "" };

describe("an assigned issue is counted once", () => {
  it("drops the notification that announces an issue that is listed", () => {
    expect(withoutIssueNotices([note("a", "task_assigned"), note("b", "ask_waiting")], [listed])?.map((n) => n.id)).toEqual(["b"]);
    expect(withoutIssueNotices(null, [listed])).toBeNull();
  });

  it("keeps the notification of an issue that is not listed, and every notification while the issues are unread", () => {
    expect(withoutIssueNotices([note("a", "task_assigned", "t9")], [listed])?.map((n) => n.id)).toEqual(["a"]);
    expect(withoutIssueNotices([note("a", "task_assigned")], null)?.map((n) => n.id)).toEqual(["a"]);
  });

  it("adds one to the count for each issue, beside the steps, invitations and asks", () => {
    const base = needsYouCount({ steps: [], invitations: [], items: withoutIssueNotices([note("a", "task_assigned"), note("b", "ask_waiting")], [listed]) });
    expect(base + [listed].length).toBe(2);
  });
});
