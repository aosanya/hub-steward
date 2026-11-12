import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { mcpInboxClient, type InboxClient, type InvitationItem, type NotificationItem } from "../inbox/api";
import { type AssignedClient, mcpAssignedClient } from "../inbox/assignedIssues";
import { withoutIssueNotices } from "../inbox/issueCount";
import { isOutage } from "../inbox/outage";
import { useClearDone } from "../inbox/clearDone";
import { NeedsYouSection } from "../inbox/NeedsYouSection";
import { needsYouCount, needsYouNotes, updatesOf } from "../inbox/needsYou";
import { mcpReader, openChecked, type Reader } from "../inbox/subjectCheck";
import { UpdatesSection } from "../inbox/UpdatesSection";
import { useAssignedIssues } from "../inbox/useAssignedIssues";
import { unreadOf, useNotifications } from "../inbox/useNotifications";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { LoadFailed } from "../ui/LoadState";
import { Shell } from "../ui/Shell";
import { mcpStartClient, type StartClient } from "../coordinator/start/api";
import { useStartWaiting } from "../coordinator/start/startWaiting";

type Opened = { invitation: InvitationItem; joined: boolean };

export function NotificationsPage({ client = mcpInboxClient, start = mcpStartClient, assigned = mcpAssignedClient, read = mcpReader, above }: { client?: InboxClient; start?: StartClient; assigned?: AssignedClient; read?: Reader; above?: ReactNode }) {
  const navigate = useNavigate();
  const { items, failed: notificationsFailed, outage: notificationsOutage, retry: retryNotifications, markIdsRead, markOneRead } = useNotifications(client);
  useClearDone(items, markIdsRead, read);
  const [ticked, setTicked] = useState<string[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [invitationsFailed, setInvitationsFailed] = useState(false);
  const [invitationsOutage, setInvitationsOutage] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState("");
  const [working, setWorking] = useState<"join" | "decline" | null>(null);
  const outage = (notificationsFailed && notificationsOutage) || (invitationsFailed && invitationsOutage);

  useEffect(() => {
    let live = true;
    client
      .listInvitations()
      .then((i) => live && setInvitations(i))
      .catch((error) => {
        if (!live) return;
        setInvitationsFailed(true);
        setInvitationsOutage(isOutage(error));
      });
    return () => {
      live = false;
    };
  }, [client, attempt]);

  const tryAgain = () => {
    setInvitationsFailed(false);
    setInvitationsOutage(false);
    setAttempt(attempt + 1);
    retryNotifications();
  };

  const waiting = useStartWaiting(start);
  const updates = updatesOf(items);
  const unread = unreadOf(updates);
  const chosen = unread.filter((n) => ticked.includes(n.id)).map((n) => n.id);
  const issues = useAssignedIssues(assigned);
  const issuesListed = issues.value !== null && !issues.failed;
  const waitingItems = issuesListed ? withoutIssueNotices(items, issues.value) : items;
  const needing = needsYouNotes(waitingItems);
  const waitsOnYou = needsYouCount({ steps: waiting ?? [], invitations, items: waitingItems }) + (issuesListed ? (issues.value ?? []).length : 0) > 0;

  if (opened) {
    const { invitation, joined } = opened;
    const leave = () => {
      setProblem("");
      setOpened(null);
    };
    const settle = () => setInvitations(invitations.filter((i) => i.id !== invitation.id));
    const attempt = async (which: "join" | "decline", call: () => Promise<void>, onDone: () => void, words: string) => {
      if (working) return;
      setProblem("");
      setWorking(which);
      try {
        await call();
      } catch {
        setProblem(words);
        setWorking(null);
        return;
      }
      setWorking(null);
      onDone();
    };
    return (
      <Shell title="Invitation" onBack={leave} inbox={client}>
        {joined ? (
          <Card>
            <p>You joined. The group's room is on Chat.</p>
          </Card>
        ) : (
          <Card>
            <p>
              {invitation.inviterName} invited you to {invitation.groupName}.
            </p>
            <p>Expires in {invitation.expiresInDays} days.</p>
            {problem ? <LoadFailed words={problem} /> : null}
            <Button
              disabled={working !== null}
              onClick={() =>
                attempt(
                  "decline",
                  () => client.declineInvitation(invitation.id),
                  () => {
                    settle();
                    leave();
                  },
                  "Could not decline the invitation. Try again.",
                )
              }
            >
              {working === "decline" ? "Declining" : "Decline"}
            </Button>
            <Button
              kind="primary"
              disabled={working !== null}
              onClick={() =>
                attempt(
                  "join",
                  () => client.acceptInvitation(invitation.id),
                  () => {
                    settle();
                    setOpened({ invitation, joined: true });
                  },
                  "Could not join the group. Try again.",
                )
              }
            >
              {working === "join" ? "Joining" : "Join"}
            </Button>
          </Card>
        )}
      </Shell>
    );
  }

  const markRead = async () => {
    const done = await markIdsRead(chosen.length > 0 ? chosen : unread.map((n) => n.id));
    setProblem(done ? "" : "Could not mark the notifications read. Try again.");
    if (done) setTicked([]);
  };

  const tick = (id: string, on: boolean) => setTicked(on ? [...ticked, id] : ticked.filter((t) => t !== id));

  const settled = items !== null || (notificationsFailed && !notificationsOutage);
  const empty = !outage && settled && waiting !== null && (issues.value !== null || issues.failed) && !waitsOnYou && updates.length === 0;

  const openNotice = (n: NotificationItem, path: string) => openChecked(n, path, { read, markOneRead, navigate, say: setProblem });

  return (
    <Shell title={above ? "Home" : "Notifications"} inbox={client}>
      {above}
      {outage ? (
        <>
          <LoadFailed words="Home could not be loaded." />
          <Button onClick={tryAgain}>Try again</Button>
        </>
      ) : null}
      {problem ? <LoadFailed words={problem} /> : null}
      {empty ? (
        <Card empty>
          <p className="ttl">You are all caught up</p>
          <p>Notifications from your groups will appear here.</p>
        </Card>
      ) : null}
      {waitsOnYou ? <NeedsYouSection start={start} assigned={assigned} invitations={invitations} notices={needing} onOpenInvitation={(invitation) => setOpened({ invitation, joined: false })} onOpenNotice={openNotice} /> : null}
      {updates.length > 0 ? <UpdatesSection notices={updates} chosen={chosen} onTick={tick} onMarkRead={markRead} onOpenNotice={openNotice} /> : null}
    </Shell>
  );
}
