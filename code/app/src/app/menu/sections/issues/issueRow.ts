export type IssueRow = { id: string; title: string; status: string };

export const emptyIssue: IssueRow = { id: "", title: "Issue", status: "" };

export const issueFromState = (state: unknown, id: string): IssueRow => {
  const row = (state as { issue?: Partial<IssueRow> } | null)?.issue;
  if (!row || row.id !== id) return { ...emptyIssue, id };
  return { id, title: row.title || emptyIssue.title, status: row.status ?? "" };
};
