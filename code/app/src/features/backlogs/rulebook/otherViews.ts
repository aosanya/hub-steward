import { allIssuesId, type Backlog } from "../shared/api";
import { boardPath, issuesPath } from "../shared/paths";
import { smartBacklogPath } from "../smart/paths";

export type IssueView = "list" | "board";

export const issueViewPath = (backlogId: string, backlog: Backlog | undefined, view: IssueView): string => {
  const list = view === "list";
  if (backlogId === allIssuesId) return list ? `${issuesPath(allIssuesId)}?view=list` : issuesPath(allIssuesId);
  if (backlog?.kind === "smart") return list ? `${smartBacklogPath(backlogId)}?view=list` : smartBacklogPath(backlogId);
  return list ? issuesPath(backlogId) : boardPath(backlogId);
};
