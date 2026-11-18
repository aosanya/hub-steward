import { useNavigate, useSearchParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { LoadingLine } from "../../../../shared/ui/LoadState";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { PageFrame } from "../../PageFrame";
import { loadMaintenanceOf } from "./maintenanceRecords";
import { assetPaths, maintenancePaths } from "./paths";

const lineOf = (done: string, by: string) => [done, by].filter(Boolean).join(" · ");

export function MaintenanceListScreen() {
  const [query] = useSearchParams();
  const navigate = useNavigate();
  const name = query.get("name") ?? "";
  const id = query.get("id") ?? "";
  const from = query.get("from") ?? assetPaths.equipment.path();
  const records = useLoad(() => loadMaintenanceOf({ id, name }), `maintenance-of:${openAgencyId()}:${id}:${name}`);
  const rows = (records.state === "ready" ? records.data : []).map((one) => (
    <ListRow key={one.id} title={one.what} meta={lineOf(one.done, one.by)} status={one.kind} onClick={() => navigate(maintenancePaths.record.path({ rowId: one.id }))} />
  ));
  return (
    <Shell title="Maintenance" titleUnder backLabel={name || "Back"} onBack={() => navigate(from)} tabless>
      {records.state === "loading" ? (
        <LoadingLine />
      ) : (
        <PageFrame title={name}>
          <Section word="Maintenance history" icon="document" rows={rows} empty={{ words: "No maintenance recorded yet." }} full />
        </PageFrame>
      )}
    </Shell>
  );
}
