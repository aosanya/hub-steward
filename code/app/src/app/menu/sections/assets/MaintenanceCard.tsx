import { useLocation, useNavigate } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { Chip } from "../../../../shared/ui/Chip";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { loadMaintenanceOf, loadMayAddMaintenance } from "./maintenanceRecords";
import { maintenancePaths } from "./paths";

type Props = { assetId: string; assetName: string };

const lineOf = (done: string, by: string) => [done, by].filter(Boolean).join(" · ");

export function MaintenanceHistory({ assetId, assetName }: Props) {
  const navigate = useNavigate();
  const here = useLocation();
  const key = openAgencyId();
  const records = useLoad(() => loadMaintenanceOf({ id: assetId, name: assetName }), `maintenance-of:${key}:${assetId}`);
  const may = useLoad(loadMayAddMaintenance, `maintenance-may:${key}`);
  const list = records.state === "ready" ? records.data : [];
  const canAdd = may.state === "ready" && may.data;
  const add = canAdd ? (
    <button type="button" className="sec-act" onClick={() => navigate(maintenancePaths.add.path({ asset: assetId, from: here.pathname + here.search }))}>Add maintenance</button>
  ) : undefined;
  const rows = list.map((one) => (
    <ListRow key={one.id} title={one.what} meta={lineOf(one.done, one.by)} end={<Chip>{one.kind}</Chip>} onClick={() => navigate(maintenancePaths.record.path({ rowId: one.id }))} />
  ));
  const opens = () => navigate(maintenancePaths.list.path({ name: assetName, id: assetId, from: here.pathname + here.search }));
  return <Section word="Maintenance history" icon="document" rows={rows} empty={{ words: "No maintenance recorded yet." }} foot={add} opens={opens} />;
}
