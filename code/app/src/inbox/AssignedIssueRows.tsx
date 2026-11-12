import { useNavigate } from "react-router-dom";
import { issuePath } from "../backlogs/paths";
import { ListRow } from "../ui/ListRow";
import { type AssignedClient, assignedIssueTitle } from "./assignedIssues";
import { useAssignedIssues } from "./useAssignedIssues";

export function AssignedIssueRows({ client }: { client?: AssignedClient }) {
  const navigate = useNavigate();
  const read = useAssignedIssues(client);
  return (
    <>
      {(read.value ?? []).map((issue) => (
        <ListRow key={`issue-${issue.id}`} title={assignedIssueTitle(issue)} meta="Issue assigned to you" start={<span className="dot" role="img" aria-label="Unread" />} onClick={() => navigate(issuePath(issue.id))} />
      ))}
    </>
  );
}
