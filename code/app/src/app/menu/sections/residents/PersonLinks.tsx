import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { dayWords } from "../../../../shared/ui/days";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { loadRecordRowsHeldBy, type RecordRow } from "../../liveRecordRows";
import { listOf, text } from "../staff/staffData";
import { servicesPaths } from "../services/paths";
import { useOpenFromPanel } from "./useOpenFromPanel";
import { businessesMetaPrompts, businessesRecordCode, businessesTitlePrompt } from "./BusinessesScreen";
import { informalTradersMetaPrompts, informalTradersRecordCode, informalTradersTitlePrompt } from "./InformalTradersScreen";

const loadApplications = (memberId: string) => async () => {
  const submissions = await listOf("forms_submission_list_of_person", { member_id: memberId });
  return submissions
    .map((submission) => ({ key: text(submission, "id"), title: text(submission, "form_title"), sentAt: text(submission, "submitted_at") }))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
};

export function PersonApplications({ id }: { id: string }) {
  const word = useWord("forms");
  const open = useOpenFromPanel();
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
            <ListRow key={application.key} title={application.title} meta={`Sent ${dayWords(application.sentAt)}`} onClick={() => open(servicesPaths.application.path({ id: application.key }))} end="›" />
          ))}
        </Rows>
      ) : null}
    </>
  );
}

const holdings = [
  { heading: "Businesses", recordCode: businessesRecordCode, titlePrompt: businessesTitlePrompt, metaPrompts: businessesMetaPrompts },
  { heading: "Informal traders", recordCode: informalTradersRecordCode, titlePrompt: informalTradersTitlePrompt, metaPrompts: informalTradersMetaPrompts },
];

const loadHeldRows = (holding: (typeof holdings)[number], actorId: string) => async (): Promise<RecordRow[]> =>
  loadRecordRowsHeldBy(holding.recordCode, holding.titlePrompt, holding.metaPrompts, actorId);

function PersonHeld({ holding, id }: { holding: (typeof holdings)[number]; id: string }) {
  const view = useLoad(loadHeldRows(holding, id), `person-held:${openAgencyId()}:${holding.recordCode}:${id}`);
  if (view.state !== "ready" || view.data.length === 0) return null;
  return (
    <>
      <SectionHeading>{holding.heading}</SectionHeading>
      <Rows>
        {view.data.map((row) => (
          <ListRow key={row.id} title={row.title} meta={row.meta} />
        ))}
      </Rows>
    </>
  );
}

export function PersonRecords({ id }: { id: string }) {
  return (
    <>
      {holdings.map((holding) => (
        <PersonHeld key={holding.recordCode} holding={holding} id={id} />
      ))}
    </>
  );
}
