import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { mcpInboxClient, type InboxClient, type NotificationItem } from "../../features/inbox/api";
import { type AssignedClient, mcpAssignedClient } from "../../features/inbox/assignedIssues";
import { AssignedIssueRows } from "../../features/inbox/AssignedIssueRows";
import { withoutIssueNotices } from "../../features/inbox/issueCount";
import { needsYouCount, needsYouNotes } from "../../features/inbox/needsYou";
import { NoticeRow } from "../../features/inbox/NoticeRow";
import { mcpReader, openChecked, type Reader } from "../../features/inbox/subjectCheck";
import { isUnpaidList } from "../../features/inbox/unpaidList";
import { useAssignedIssues } from "../../features/inbox/useAssignedIssues";
import { useInvitations } from "../../features/inbox/useInvitations";
import { useNotifications } from "../../features/inbox/useNotifications";
import { mcpStartClient, StartWaitingRows, useStartWaitingState, type StartClient } from "../../features/market";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { needsYouPath } from "../tabs";

type Props = { inbox?: InboxClient; start?: StartClient; assigned?: AssignedClient; read?: Reader };

export function ToDoRows({ inbox = mcpInboxClient, start = mcpStartClient, assigned = mcpAssignedClient, read = mcpReader }: Props) {
  const navigate = useNavigate();
  const { words } = useLanguage();
  const [problem, setProblem] = useState("");
  const notifications = useNotifications(inbox);
  const invitations = useInvitations(inbox);
  const waiting = useStartWaitingState(start);
  const issues = useAssignedIssues(assigned);
  const issuesListed = issues.value !== null && !issues.failed;
  const items = issuesListed ? withoutIssueNotices(notifications.items, issues.value) : notifications.items;
  const notices = needsYouNotes(items);
  const held = needsYouCount({ steps: waiting.steps, invitations: invitations.value ?? [], items }) + (issuesListed ? (issues.value ?? []).length : 0);
  const failed = waiting.status === "failed" || issues.failed || invitations.failed;
  const reading = waiting.status === "loading" || invitations.value === null || (issues.value === null && !issues.failed);
  const retry = () => {
    waiting.retry();
    issues.refresh();
    invitations.refresh();
  };
  const openNotice = (notice: NotificationItem, path: string) => {
    if (isUnpaidList(notice)) return navigate(needsYouPath(openAgencyId()));
    return openChecked(notice, path, { read, markOneRead: notifications.markOneRead, navigate, say: setProblem });
  };
  return (
    <>
      {held > 0 ? (
        <Rows>
          <StartWaitingRows client={start} />
          <AssignedIssueRows client={assigned} />
          {(invitations.value ?? []).map((invitation) => (
            <ListRow key={`invitation-${invitation.id}`} title={`You are invited to ${invitation.groupName}`} start={<span className="dot" role="img" aria-label="Unread" />} onClick={() => navigate(needsYouPath(openAgencyId()))} />
          ))}
          {notices.map((notice) => (
            <NoticeRow key={notice.id} notice={notice} onOpen={openNotice} />
          ))}
        </Rows>
      ) : null}
      {held === 0 && reading && !failed ? <LoadingLine /> : null}
      {held === 0 && !reading && !failed ? <EmptyCard words={words.myWorkNothingToDo} /> : null}
      {problem ? <LoadFailed words={problem} /> : null}
      {failed ? <LoadFailed words={words.myWorkToDoFailed} onRetry={retry} /> : null}
    </>
  );
}
