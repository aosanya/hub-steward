import { useLoad } from "../../../../features/forms/useLoad";
import { useMay } from "../../../../features/agency/useMay";
import { dayWords } from "../../../../shared/ui/days";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { approvedWords } from "./decision";
import { useDecisionCount } from "./decisionSignal";
import { loadReceived } from "./ReceivedApplications";

const sectionWords = "Granted";

const emptyWords = "No one has been granted this yet.";

const newestDecidedFirst = (a: { decidedAt: string }, b: { decidedAt: string }) => b.decidedAt.localeCompare(a.decidedAt);

const loadGranted = async (slug: string) => {
  const { rows } = await loadReceived(slug);
  return rows.filter((row) => row.status === approvedWords).sort(newestDecidedFirst);
};

function GrantedList({ slug }: { slug: string }) {
  const decisions = useDecisionCount();
  const view = useLoad(() => loadGranted(slug), `granted:${openAgencyId()}:${slug}:${decisions}`);
  if (view.state !== "ready") return null;
  return (
    <>
      <SectionHeading>{sectionWords}</SectionHeading>
      {view.data.length === 0 ? (
        <EmptyCard words={emptyWords} />
      ) : (
        <Rows>
          {view.data.map((row) => (
            <ListRow key={row.memberId} title={row.name} meta={dayWords(row.decidedAt)} />
          ))}
        </Rows>
      )}
    </>
  );
}

export function Granted({ slug }: { slug: string }) {
  return useMay("form.results") ? <GrantedList slug={slug} /> : null;
}
