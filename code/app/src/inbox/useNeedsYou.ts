import { type InboxClient, mcpInboxClient } from "./api";
import { mcpStartClient, type StartClient } from "../coordinator/start/api";
import { useStartWaitingRead } from "../coordinator/start/startWaiting";
import { needsYouCount, newsUnreadIn } from "./needsYou";
import { useInvitations } from "./useInvitations";
import { useNotifications } from "./useNotifications";

export function useNeedsYou(inbox: InboxClient = mcpInboxClient, start: StartClient = mcpStartClient) {
  const notifications = useNotifications(inbox);
  const invitations = useInvitations(inbox);
  const steps = useStartWaitingRead(start);
  const failed = notifications.failed || invitations.failed || steps.failed;
  const known = notifications.items !== null && invitations.value !== null && steps.value !== null;
  const count = known && !failed ? needsYouCount({ steps: steps.value ?? [], invitations: invitations.value ?? [], items: notifications.items }) : null;
  const newsUnread = notifications.items !== null && newsUnreadIn(notifications.items);
  return { count, newsUnread, failed, refreshInvitations: invitations.refresh };
}
