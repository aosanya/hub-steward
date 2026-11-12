import type { StartClient } from "../coordinator/start/api";
import { StartWaitingRows } from "../coordinator/start/Waiting";
import { ListRow, Rows } from "../ui/ListRow";
import { needsYouAnchor } from "../tabs";
import { SectionHeading } from "../ui/SectionHeading";
import type { InvitationItem, NotificationItem } from "./api";
import { NoticeRow } from "./NoticeRow";

type Props = {
  start: StartClient;
  invitations: InvitationItem[];
  notices: NotificationItem[];
  onOpenInvitation: (invitation: InvitationItem) => void;
  onOpenNotice: (notice: NotificationItem, path: string) => void;
};

export function NeedsYouSection({ start, invitations, notices, onOpenInvitation, onOpenNotice }: Props) {
  return (
    <>
      <SectionHeading id={needsYouAnchor}>Needs you</SectionHeading>
      <Rows>
        <StartWaitingRows client={start} />
        {invitations.map((i) => (
          <ListRow key={`invitation-${i.id}`} title={`You are invited to ${i.groupName}`} start={<span className="dot" role="img" aria-label="Unread" />} onClick={() => onOpenInvitation(i)} />
        ))}
        {notices.map((n) => (
          <NoticeRow key={n.id} notice={n} onOpen={onOpenNotice} />
        ))}
      </Rows>
    </>
  );
}
