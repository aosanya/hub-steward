import { type InboxClient, mcpInboxClient } from "./api";
import { type AssignedClient, mcpAssignedClient } from "./assignedIssues";
import { mcpStartClient, type StartClient } from "../coordinator/start/api";
import { useStartWaitingRead } from "../coordinator/start/startWaiting";
import { withoutIssueNotices } from "./issueCount";
import { needsYouCount, newsUnreadIn } from "./needsYou";
import { useAssignedIssues } from "./useAssignedIssues";
import { useInvitations } from "./useInvitations";
import { useNotifications } from "./useNotifications";

export function useNeedsYou(inbox: InboxClient = mcpInboxClient, start: StartClient = mcpStartClient, assigned: AssignedClient = mcpAssignedClient) {
  const notifications = useNotifications(inbox);
  const invitations = useInvitations(inbox);
  const steps = useStartWaitingRead(start);
  const issues = useAssignedIssues(assigned);
  const failed = notifications.failed || invitations.failed || steps.failed;
  const issuesListed = issues.value !== null && !issues.failed;
  const issuesPending = issues.value === null && !issues.failed;
  const known = notifications.items !== null && invitations.value !== null && steps.value !== null && !issuesPending;
  const items = issuesListed ? withoutIssueNotices(notifications.items, issues.value) : notifications.items;
  const count =
    known && !failed ? needsYouCount({ steps: steps.value ?? [], invitations: invitations.value ?? [], items }) + (issuesListed ? (issues.value ?? []).length : 0) : null;
  const newsUnread = notifications.items !== null && newsUnreadIn(notifications.items);
  return { count, newsUnread, failed, refreshInvitations: invitations.refresh };
}
