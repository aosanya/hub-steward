import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { ApplicationRows, loadApplications } from "./PersonLinks";

function LicencesAndPermits({ ownerId, rowId }: { ownerId: string; rowId: string }) {
  const word = useWord("forms");
  const view = useLoad(loadApplications(ownerId, rowId), `record-applications:${openAgencyId()}:${rowId}`);
  if (view.state !== "ready" || view.data.length === 0) return null;
  return (
    <>
      <SectionHeading>{word("Licences and permits")}</SectionHeading>
      <ApplicationRows applications={view.data} />
    </>
  );
}

export function RecordApplications({ ownerId, rowId }: { ownerId: string; rowId: string }) {
  return ownerId && rowId ? <LicencesAndPermits ownerId={ownerId} rowId={rowId} /> : null;
}
