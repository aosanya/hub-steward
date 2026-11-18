import { useNavigate } from "react-router-dom";
import { useLoad } from "../../features/forms/useLoad";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { loadMayAddRows } from "./liveRecordRows";

type Props = { recordCode: string; to: string };

export function RecordEditAct({ recordCode, to }: Props) {
  const navigate = useNavigate();
  const may = useLoad(() => loadMayAddRows(recordCode), `may-add-rows:${openAgencyId()}:${recordCode}`);
  if (may.state !== "ready" || !may.data) return null;
  return <button type="button" className="sec-act" onClick={() => navigate(to)}>Edit</button>;
}
