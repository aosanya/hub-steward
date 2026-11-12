import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { Words } from "../entry/words";
import { useLanguage } from "../entry/language";
import { mcpInboxClient, type InboxClient, type InvitationItem, type NotificationItem } from "../inbox/api";
import { chatMetaOf, chatTitleOf, threadPathOf } from "../inbox/chatNotice";
import { noticeMetaOf, noticePathOf, noticeTitleOf } from "../inbox/notice";
import { isOutage } from "../inbox/outage";
import { unreadOf, useNotifications } from "../inbox/useNotifications";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { LoadFailed } from "../ui/LoadState";
import { isoDay } from "../ui/days";
import { Rows, SelectableRow } from "../ui/ListRow";
import { Shell } from "../ui/Shell";
import { orderPath } from "../coordinator/payments/OrderCards";
import { mcpStartClient, type StartClient } from "../coordinator/start/api";
import { useStartWaiting } from "../coordinator/start/startWaiting";
import { StartWaitingRows } from "../coordinator/start/Waiting";

const titleOf = (n: NotificationItem, words: Words) => noticeTitleOf(n, words) ?? chatTitleOf(n, words) ?? words.inboxNotification;

const metaOf = (n: NotificationItem, words: Words) => noticeMetaOf(n, words) ?? chatMetaOf(n);

const calledOff = (n: NotificationItem) => n.event === "group_order_called_off" && n.subjectKind === "group_order" && n.subjectId !== "";

const pathOf = (n: NotificationItem) => (calledOff(n) ? orderPath(n.subjectId) : (noticePathOf(n) ?? threadPathOf(n)));

type Opened = { invitation: InvitationItem; joined: boolean };

export function InboxPage({ client = mcpInboxClient, start = mcpStartClient, above }: { client?: InboxClient; start?: StartClient; above?: ReactNode }) {
  const navigate = useNavigate();
  const { words } = useLanguage();
  const { items, failed: notificationsFailed, outage: notificationsOutage, retry: retryNotifications, markAllRead, markIdsRead, markOneRead } = useNotifications(client);
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
  const unread = unreadOf(items);
  const anythingUnread = unread.length > 0;
  const chosen = unread.filter((n) => ticked.includes(n.id)).map((n) => n.id);

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
    const done = await (chosen.length > 0 ? markIdsRead(chosen) : markAllRead());
    setProblem(done ? "" : "Could not mark the notifications read. Try again.");
    if (done) setTicked([]);
  };

  const tick = (id: string, on: boolean) => setTicked(on ? [...ticked, id] : ticked.filter((t) => t !== id));

  const settled = items !== null || (notificationsFailed && !notificationsOutage);
  const empty = !outage && settled && waiting !== null && (items ?? []).length === 0 && invitations.length === 0 && waiting.length === 0;

  return (
    <Shell title="Home" inbox={client} action={anythingUnread ? <Button onClick={markRead}>{chosen.length > 0 ? "Mark read" : "Mark all read"}</Button> : undefined}>
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
      {invitations.length > 0 || (items ?? []).length > 0 || (waiting ?? []).length > 0 ? (
        <Rows>
          <StartWaitingRows client={start} />
          {invitations.map((i) => (
            <SelectableRow
              key={`invitation-${i.id}`}
              selection={null}
              title={`You are invited to ${i.groupName}`}
              start={<span className="dot" role="img" aria-label="Unread" />}
              onClick={() => setOpened({ invitation: i, joined: false })}
            />
          ))}
          {(items ?? []).map((n) => {
            const path = pathOf(n);
            return (
              <SelectableRow
                key={n.id}
                selection={n.read ? null : { checked: chosen.includes(n.id), onChange: (on) => tick(n.id, on), label: `Select ${titleOf(n, words)}` }}
                title={titleOf(n, words)}
                meta={metaOf(n, words)}
                start={n.read || !path ? <span className="dot off" aria-hidden="true" /> : <span className="dot" role="img" aria-label="Unread" />}
                end={isoDay(n.createdAt)}
                onClick={
                  path
                    ? () => {
                        if (!n.read) markOneRead(n.id);
                        navigate(path);
                      }
                    : undefined
                }
              />
            );
          })}
        </Rows>
      ) : null}
    </Shell>
  );
}
