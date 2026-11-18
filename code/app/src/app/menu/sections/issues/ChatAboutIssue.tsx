import { useLocation } from "react-router-dom";
import { useChatAboutSubject } from "../residents/SubjectChat";
import type { IssueRow } from "./issueRow";

export const issueParam = "issue";

type Props = { issue: IssueRow; department: string; place: string };

const detailsOf = ({ issue, department, place }: Props) =>
  [
    issue.status ? `Status: ${issue.status}` : "",
    department ? `Department: ${department}` : "",
    place ? `Place: ${place}` : "",
  ]
    .filter(Boolean)
    .join(". ");

export function ChatAboutIssue(props: Props) {
  const { issue } = props;
  const back = `${useLocation().pathname}?${issueParam}=${issue.id}`;
  const subject = issue.id === "" ? null : { kind: "issue" as const, id: issue.id, name: issue.title, extra: { board: issue.boardItemId, details: detailsOf(props) } };
  useChatAboutSubject(subject, back);
  return null;
}
