import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { ApplicationRows, loadApplications } from "./applicationRows";
import { LicenceChip } from "./LicenceChip";
import { loadLicenceMarks } from "./licensedRows";

type Props = { ownerId: string; rowId: string; licenceRecord?: string };

function LicencesAndPermits({ ownerId, rowId, licenceRecord }: Props) {
  const word = useWord("forms");
  const view = useLoad(loadApplications(ownerId, rowId), `record-applications:${openAgencyId()}:${rowId}`);
  const marks = useLoad(async () => (licenceRecord ? loadLicenceMarks(licenceRecord) : null), `record-licence-mark:${openAgencyId()}:${licenceRecord ?? ""}:${rowId}`);
  if (view.state !== "ready" || view.data.length === 0) return null;
  const mark = marks.state === "ready" ? marks.data?.get(rowId) : undefined;
  return (
    <>
      <SectionHeading action={mark ? <LicenceChip mark={mark} /> : undefined}>{word("Licences and permits")}</SectionHeading>
      <ApplicationRows applications={view.data} />
    </>
  );
}

export function RecordApplications({ ownerId, rowId, licenceRecord }: Props) {
  return ownerId && rowId ? <LicencesAndPermits ownerId={ownerId} rowId={rowId} licenceRecord={licenceRecord} /> : null;
}
