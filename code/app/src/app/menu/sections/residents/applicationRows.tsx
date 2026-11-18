import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { dayWords } from "../../../../shared/ui/days";
import { listOf, text } from "../staff/staffData";
import { servicesPaths } from "../services/paths";
import { useOpenFromPanel } from "./useOpenFromPanel";

export type Application = { key: string; title: string; sentAt: string };

export const loadApplications = (memberId: string, rowId?: string) => async (): Promise<Application[]> => {
  const submissions = await listOf("forms_submission_list_of_person", rowId ? { member_id: memberId, record_row_id: rowId } : { member_id: memberId });
  return submissions
    .map((submission) => ({ key: text(submission, "id"), title: text(submission, "form_title"), sentAt: text(submission, "submitted_at") }))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
};

export const applicationRowList = (applications: Application[], open: (path: string) => void) =>
  applications.map((application) => (
    <ListRow key={application.key} title={application.title} meta={`Sent ${dayWords(application.sentAt)}`} onClick={() => open(servicesPaths.application.path({ id: application.key }))} end="›" />
  ));

export function ApplicationRows({ applications }: { applications: Application[] }) {
  const open = useOpenFromPanel();
  return <Rows>{applicationRowList(applications, open)}</Rows>;
}
