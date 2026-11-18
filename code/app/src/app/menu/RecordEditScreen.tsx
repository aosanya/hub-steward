import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../features/forms/useLoad";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { loadRecordRow, recordRowIdKey } from "./liveRecordRows";
import { RecordRowForm, type RecordFormField } from "./RecordRowForm";
import { Shell } from "../Shell";

type Props = {
  title: string;
  recordCode: string;
  fields: RecordFormField[];
  back: { to: (id: string) => string; label: string };
};

const savedAnswers = (row: Record<string, string>) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== recordRowIdKey));

export function RecordEditScreen({ title, recordCode, fields, back }: Props) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const prompts = fields.map((field) => field.prompt);
  const view = useLoad(() => loadRecordRow(recordCode, id, prompts), `record-edit:${openAgencyId()}:${recordCode}:${id}`);
  const to = back.to(id);
  if (view.state !== "ready" || !view.data[recordRowIdKey]) {
    return (
      <Shell title={title} titleUnder backLabel={back.label} onBack={() => navigate(to)} tabless>
        {view.state === "loading" ? <LoadingLine /> : <LoadFailed words="This could not be loaded." />}
      </Shell>
    );
  }
  return <RecordRowForm title={title} recordCode={recordCode} fields={fields} back={{ to, label: back.label, toSaved: back.to }} edit={{ rowId: id, saved: savedAnswers(view.data) }} />;
}
