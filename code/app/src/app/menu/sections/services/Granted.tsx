import { useLoad } from "../../../../features/forms/useLoad";
import { useMay } from "../../../../features/agency/useMay";
import { dayWords, endDayWords } from "../../../../shared/ui/days";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { LicenceChip } from "../residents/LicenceChip";
import { markOf, todayIso } from "../residents/licensedRows";
import { approvedWords, validUntilWords } from "./decision";
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
  const rows = view.data.map((row) => (
    <ListRow
      key={row.memberId}
      title={row.name}
      meta={[dayWords(row.decidedAt), row.validUntil === "" ? "" : `${validUntilWords} ${endDayWords(row.validUntil)}`]}
      end={<LicenceChip mark={markOf([{ rowId: row.memberId, validUntil: row.validUntil }], todayIso())} />}
    />
  ));
  return <Section word={sectionWords} icon="users" all rows={rows} empty={{ words: emptyWords }} />;
}

export function Granted({ slug }: { slug: string }) {
  return useMay("form.results") ? <GrantedList slug={slug} /> : null;
}
