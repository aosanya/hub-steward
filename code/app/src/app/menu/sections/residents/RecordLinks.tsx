import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { Section } from "../../../../shared/ui/Section";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { applicationRowList, loadApplications } from "./applicationRows";
import { LicenceChip } from "./LicenceChip";
import { loadLicenceMarks } from "./licensedRows";
import { useOpenFromPanel } from "./useOpenFromPanel";

type Props = { ownerId: string; rowId: string; licenceRecord?: string };

function LicencesAndPermits({ ownerId, rowId, licenceRecord }: Props) {
  const word = useWord("forms");
  const open = useOpenFromPanel();
  const view = useLoad(loadApplications(ownerId, rowId), `record-applications:${openAgencyId()}:${rowId}`);
  const marks = useLoad(async () => (licenceRecord ? loadLicenceMarks(licenceRecord) : null), `record-licence-mark:${openAgencyId()}:${licenceRecord ?? ""}:${rowId}`);
  if (view.state !== "ready" || view.data.length === 0) return null;
  const mark = marks.state === "ready" ? marks.data?.get(rowId) : undefined;
  return <Section icon="document" word={word("Licences and permits")} badge={mark ? <LicenceChip mark={mark} /> : undefined} rows={applicationRowList(view.data, open)} />;
}

export function RecordApplications({ ownerId, rowId, licenceRecord }: Props) {
  return ownerId && rowId ? <LicencesAndPermits ownerId={ownerId} rowId={rowId} licenceRecord={licenceRecord} /> : null;
}
