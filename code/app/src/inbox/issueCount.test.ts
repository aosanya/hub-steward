import { describe, expect, it } from "vitest";
import type { NotificationItem } from "./api";
import { withoutIssueNotices } from "./issueCount";
import { needsYouCount } from "./needsYou";

const note = (id: string, event: string): NotificationItem => ({ id, event, subjectKind: "issue", subjectId: "t1", names: {}, createdAt: "2026-11-12T10:00:00Z", read: false });

describe("an assigned issue is counted once", () => {
  it("drops the notification that announces it, the issue itself is listed", () => {
    expect(withoutIssueNotices([note("a", "task_assigned"), note("b", "ask_waiting")])?.map((n) => n.id)).toEqual(["b"]);
    expect(withoutIssueNotices(null)).toBeNull();
  });

  it("adds one to the count for each issue, beside the steps, invitations and asks", () => {
    const base = needsYouCount({ steps: [], invitations: [], items: withoutIssueNotices([note("a", "task_assigned"), note("b", "ask_waiting")]) });
    expect(base + [{ id: "t1", code: "HS-002", title: "Review", step: "" }].length).toBe(2);
  });
});
