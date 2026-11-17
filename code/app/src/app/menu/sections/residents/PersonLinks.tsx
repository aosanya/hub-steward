import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { dayWords } from "../../../../shared/ui/days";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { listOf, text, type Item } from "../staff/staffData";

type Application = { key: string; title: string; sentAt: string };

const applicationsOfForm = async (form: Item, memberId: string): Promise<Application[]> => {
  const formId = text(form, "id");
  const submissions = await listOf("forms_submission_list", { form_id: formId, member_id: memberId }).catch(() => [] as Item[]);
  return submissions.map((submission) => ({ key: `${formId}:${text(submission, "id")}`, title: text(form, "title"), sentAt: text(submission, "submitted_at") }));
};

const loadApplications = (memberId: string) => async () => {
  const forms = await listOf("forms_form_list");
  const perForm = await Promise.all(forms.map((form) => applicationsOfForm(form, memberId)));
  return perForm.flat().sort((a, b) => b.sentAt.localeCompare(a.sentAt));
};

export function PersonApplications({ id }: { id: string }) {
  const word = useWord("forms");
  const view = useLoad(loadApplications(id), `person-applications:${openAgencyId()}:${id}`);
  if (view.state === "error") return null;
  const applications = view.state === "ready" ? view.data : [];
  return (
    <>
      <SectionHeading>{word("Applications")}</SectionHeading>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "ready" && applications.length === 0 ? <EmptyCard words="No applications yet." /> : null}
      {applications.length > 0 ? (
        <Rows>
          {applications.map((application) => (
            <ListRow key={application.key} title={application.title} meta={`Sent ${dayWords(application.sentAt)}`} />
          ))}
        </Rows>
      ) : null}
    </>
  );
}
