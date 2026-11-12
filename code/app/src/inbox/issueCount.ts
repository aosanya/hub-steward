import type { NotificationItem } from "./api";

export const withoutIssueNotices = (items: NotificationItem[] | null) => (items === null ? null : items.filter((n) => n.event !== "task_assigned"));
