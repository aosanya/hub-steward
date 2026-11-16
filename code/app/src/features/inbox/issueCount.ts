import type { NotificationItem } from "./api";
import type { AssignedIssue } from "./assignedIssues";

export const withoutIssueNotices = (items: NotificationItem[] | null, issues: AssignedIssue[] | null) => {
  if (items === null) return null;
  const listed = new Set((issues ?? []).map((issue) => issue.id));
  return items.filter((n) => !(n.event === "task_assigned" && listed.has(n.subjectId)));
};
