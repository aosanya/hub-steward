import { useLoad } from "../../features/forms/useLoad";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { AddAct } from "./AddButton";
import { loadMayAddRows } from "./liveRecordRows";

type Props = { recordCode: string; label: string; to: string };

export function RecordAddButton({ recordCode, label, to }: Props) {
  const may = useLoad(() => loadMayAddRows(recordCode), `may-add-rows:${openAgencyId()}:${recordCode}`);
  if (may.state !== "ready" || !may.data) return null;
  return <AddAct label={label} to={to} />;
}
