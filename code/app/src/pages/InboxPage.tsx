import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Words } from "../entry/words";
import { useLanguage } from "../entry/language";
import { mcpInboxClient, type InboxClient, type InvitationItem, type NotificationItem } from "../inbox/api";
import { chatMetaOf, chatTitleOf, threadPathOf } from "../inbox/chatNotice";
import { noticeMetaOf, noticeTitleOf } from "../inbox/notice";
import { unreadOf, useNotifications } from "../inbox/useNotifications";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { LoadFailed } from "../ui/LoadState";
import { isoDay } from "../ui/days";
import { ListRow, Rows } from "../ui/ListRow";
import { Shell } from "../ui/Shell";
import { orderPath } from "../coordinator/payments/OrderCards";
import { mcpStartClient, type StartClient } from "../coordinator/start/api";
import { useStartWaiting } from "../coordinator/start/startWaiting";
import { StartInboxRows } from "../coordinator/start/Waiting";

const titleOf = (n: NotificationItem, words: Words) => noticeTitleOf(n, words) ?? chatTitleOf(n, words) ?? words.inboxNotification;

const metaOf = (n: NotificationItem, words: Words) => noticeMetaOf(n, words) ?? chatMetaOf(n);

const calledOff = (n: NotificationItem) => n.event === "group_order_called_off" && n.subjectKind === "group_order" && n.subjectId !== "";

const pathOf = (n: NotificationItem) => (calledOff(n) ? orderPath(n.subjectId) : threadPathOf(n));

type Opened = { invitation: InvitationItem; joined: boolean };

export function InboxPage({ client = mcpInboxClient, start = mcpStartClient }: { client?: InboxClient; start?: StartClient }) {
  const navigate = useNavigate();
  const { words } = useLanguage();
  const { items, failed: notificationsFailed, markAllRead, markOneRead } = useNotifications(client);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [invitationsFailed, setInvitationsFailed] = useState(false);
  const [problem, setProblem] = useState("");
  const failed = notificationsFailed || invitationsFailed;

  useEffect(() => {
    let live = true;
    client
      .listInvitations()
      .then((i) => live && setInvitations(i))
      .catch(() => live && setInvitationsFailed(true));
    return () => {
      live = false;
    };
  }, [client]);

  const waiting = useStartWaiting(start);
  const unread = unreadOf(items);
  const anythingUnread = unread.length > 0;

  if (opened) {
    const { invitation, joined } = opened;
    const leave = () => {
      setProblem("");
      setOpened(null);
    };
    const settle = () => setInvitations(invitations.filter((i) => i.id !== invitation.id));
    const attempt = async (call: () => Promise<void>, onDone: () => void, words: string) => {
      setProblem("");
      try {
        await call();
      } catch {
        setProblem(words);
        return;
      }
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
              onClick={() =>
                attempt(
                  () => client.declineInvitation(invitation.id),
                  () => {
                    settle();
                    leave();
                  },
                  "Could not decline the invitation. Try again.",
                )
              }
            >
              Decline
            </Button>
            <Button
              kind="primary"
              onClick={() =>
                attempt(
                  () => client.acceptInvitation(invitation.id),
                  () => {
                    settle();
                    setOpened({ invitation, joined: true });
                  },
                  "Could not join the group. Try again.",
                )
              }
            >
              Join
            </Button>
          </Card>
        )}
      </Shell>
    );
  }

  const markAll = async () => {
    setProblem((await markAllRead()) ? "" : "Could not mark the notifications read. Try again.");
  };

  const empty = !failed && items !== null && waiting !== null && items.length === 0 && invitations.length === 0 && waiting.length === 0;

  return (
    <Shell title="Inbox" inbox={client} action={anythingUnread ? <Button onClick={markAll}>Mark all read</Button> : undefined}>
      {failed ? <LoadFailed words="The Inbox could not be loaded." /> : null}
      {problem ? <LoadFailed words={problem} /> : null}
      {empty ? (
        <Card empty>
          <p className="ttl">You are all caught up</p>
          <p>Notifications from your groups will appear here.</p>
        </Card>
      ) : null}
      {invitations.length > 0 || (items ?? []).length > 0 || (waiting ?? []).length > 0 ? (
        <Rows>
          <StartInboxRows client={start} />
          {invitations.map((i) => (
            <ListRow
              key={`invitation-${i.id}`}
              title={`You are invited to ${i.groupName}`}
              start={<span className="dot" role="img" aria-label="Unread" />}
              onClick={() => setOpened({ invitation: i, joined: false })}
            />
          ))}
          {(items ?? []).map((n) => {
            const path = pathOf(n);
            return (
              <ListRow
                key={n.id}
                title={titleOf(n, words)}
                meta={metaOf(n, words)}
                start={n.read ? <span className="dot off" aria-hidden="true" /> : <span className="dot" role="img" aria-label="Unread" />}
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
