import type { StartClient } from "../coordinator/start/api";
import { StartWaitingRows } from "../coordinator/start/Waiting";
import { ListRow, Rows } from "../ui/ListRow";
import { LoadFailed, LoadingLine } from "../ui/LoadState";
import { needsYouAnchor } from "../tabs";
import { SectionHeading } from "../ui/SectionHeading";
import type { InvitationItem, NotificationItem } from "./api";
import { AssignedIssueRows } from "./AssignedIssueRows";
import type { AssignedClient } from "./assignedIssues";
import { NoticeRow } from "./NoticeRow";
import type { SectionState } from "./sectionState";

type Props = {
  start: StartClient;
  assigned?: AssignedClient;
  invitations: InvitationItem[];
  notices: NotificationItem[];
  state: SectionState;
  hasRows: boolean;
  onRetry: () => void;
  onOpenInvitation: (invitation: InvitationItem) => void;
  onOpenNotice: (notice: NotificationItem, path: string) => void;
};

export function NeedsYouSection({ start, assigned, invitations, notices, state, hasRows, onRetry, onOpenInvitation, onOpenNotice }: Props) {
  return (
    <>
      <SectionHeading id={needsYouAnchor}>Needs you</SectionHeading>
      {state.loading ? <LoadingLine words="Loading Needs you" /> : null}
      {state.words ? <LoadFailed words={state.words} onRetry={onRetry} /> : null}
      {hasRows ? (
        <Rows>
          <StartWaitingRows client={start} />
          <AssignedIssueRows client={assigned} />
          {invitations.map((i) => (
            <ListRow key={`invitation-${i.id}`} title={`You are invited to ${i.groupName}`} start={<span className="dot" role="img" aria-label="Unread" />} onClick={() => onOpenInvitation(i)} />
          ))}
          {notices.map((n) => (
            <NoticeRow key={n.id} notice={n} onOpen={onOpenNotice} />
          ))}
        </Rows>
      ) : null}
    </>
  );
}
