import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMayAnswer } from "../../../../features/agency/useMay";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { refusalWords } from "../../MenuEditForm";
import { writeRegisterDetails, type RegisterDetail } from "../../registerDetails";
import { settingsPaths } from "./paths";
import { detailsOfRecord, isFixed, recordOfCode, type RegisterRecord } from "./registerRecords";

const notAllowedWords = "You may not change this.";

const editPermission = "permission.override";

const loadRecordDetails = async (id: string) => {
  const record = await recordOfCode(id);
  return record ? { record, details: await detailsOfRecord(record) } : null;
};

function DetailsForm({ record, shown, done }: { record: RegisterRecord; shown: RegisterDetail[]; done: () => void }) {
  const [details, setDetails] = useState(shown);
  const [newDetail, setNewDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const change = (prompt: string, patch: Partial<RegisterDetail>) =>
    setDetails((was) => was.map((detail) => (detail.prompt === prompt ? { ...detail, ...patch } : detail)));
  const taken = details.some((detail) => detail.prompt.toLowerCase() === newDetail.trim().toLowerCase());
  const add = () => {
    setDetails((was) => [...was, { prompt: newDetail.trim(), on: true, required: false, own: true }]);
    setNewDetail("");
  };
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      await writeRegisterDetails(record.code, details);
      done();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      {details.map((detail) => {
        const fixed = isFixed(record, detail);
        return (
          <div key={detail.prompt} className="sec-tools">
            <p className="person-name">{detail.prompt}</p>
            <label className="chip">
              <input type="checkbox" aria-label={`${detail.prompt} on`} checked={detail.on} disabled={fixed} onChange={(event) => change(detail.prompt, { on: event.target.checked, required: event.target.checked && detail.required })} /> On
            </label>
            <label className="chip">
              <input type="checkbox" aria-label={`${detail.prompt} required`} checked={detail.required} disabled={fixed || !detail.on} onChange={(event) => change(detail.prompt, { required: event.target.checked })} /> Required
            </label>
          </div>
        );
      })}
      <Field label="New detail" value={newDetail} onChange={(event) => setNewDetail(event.target.value)} />
      <Button kind="quiet" disabled={newDetail.trim() === "" || taken} onClick={add}>Add detail</Button>
      <Button kind="primary" disabled={saving} onClick={save}>Save</Button>
      <Button kind="quiet" disabled={saving} onClick={done}>Cancel</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}

export function RegisterDetailsEdit() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { known, may } = useMayAnswer(editPermission);
  const view = useLoad(() => loadRecordDetails(id), `register-details-edit:${openAgencyId()}:${id}`);
  const back = () => navigate(settingsPaths.registerDetails.path({ item: id }));
  const record = view.state === "ready" ? view.data?.record : undefined;
  return (
    <Shell title="Edit details" titleUnder onBack={back} backLabel={record?.name || "Back"} tabless>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="This could not be loaded." /> : null}
      {view.state === "ready" && view.data && known && may ? <div className="person-page"><DetailsForm record={view.data.record} shown={view.data.details} done={back} /></div> : null}
      {view.state === "ready" && known && !may ? (
        <div className="person-page">
          <p className="quiet-line">{notAllowedWords}</p>
          <Button kind="quiet" onClick={back}>Back</Button>
        </div>
      ) : null}
    </Shell>
  );
}
