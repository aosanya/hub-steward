import { useEffect, useState } from "react";
import { Button } from "../../../../shared/ui/Button";
import { ChoiceGroup, ChoiceRow } from "../../../../shared/ui/ChoiceRow";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { Shell } from "../../../Shell";
import { refusalWords } from "../../MenuEditForm";
import {
  detailsOf,
  holdingFields,
  holdingRecordCode,
  holdingTitlePrompt,
  readRegisterDetails,
  residentFields,
  residentRecordCode,
  residentTitlePrompt,
  writeRegisterDetails,
  type RegisterDetail,
} from "../../registerDetails";
import { useBackToSection } from "../../useBackToSection";
import { businessesRecordCode, businessesTitlePrompt, businessFields } from "../residents/BusinessesScreen";
import { informalTraderFields, informalTradersRecordCode, informalTradersTitlePrompt } from "../residents/InformalTradersScreen";

const records = [
  { name: "Businesses", code: businessesRecordCode, fields: businessFields, titlePrompt: businessesTitlePrompt },
  { name: "Informal traders", code: informalTradersRecordCode, fields: informalTraderFields, titlePrompt: informalTradersTitlePrompt },
  { name: "Residents", code: residentRecordCode, fields: residentFields, titlePrompt: residentTitlePrompt },
  { name: "Holdings", code: holdingRecordCode, fields: holdingFields, titlePrompt: holdingTitlePrompt },
];

export function RegisterDetails() {
  const back = useBackToSection();
  const [chosen, setChosen] = useState(records[0]);
  const [details, setDetails] = useState<RegisterDetail[] | null>(null);
  const [newDetail, setNewDetail] = useState("");
  const [saved, setSaved] = useState(false);
  const [refused, setRefused] = useState("");
  useEffect(() => {
    let live = true;
    setDetails(null);
    setSaved(false);
    readRegisterDetails(chosen.code).then((kept) => live && setDetails(detailsOf(chosen.fields, kept)));
    return () => {
      live = false;
    };
  }, [chosen]);
  const change = (prompt: string, patch: Partial<RegisterDetail>) => {
    setSaved(false);
    setDetails((was) => (was ?? []).map((detail) => (detail.prompt === prompt ? { ...detail, ...patch } : detail)));
  };
  const taken = (details ?? []).some((detail) => detail.prompt.toLowerCase() === newDetail.trim().toLowerCase());
  const add = () => {
    setDetails((was) => [...(was ?? []), { prompt: newDetail.trim(), on: true, required: false, own: true }]);
    setNewDetail("");
    setSaved(false);
  };
  const save = async () => {
    setRefused("");
    try {
      await writeRegisterDetails(chosen.code, details ?? []);
      setSaved(true);
    } catch (error) {
      setRefused(refusalWords(error));
    }
  };
  return (
    <Shell title="Details of a record" titleUnder {...back}>
      <ChoiceGroup label="Record">
        {records.map((record) => (
          <ChoiceRow key={record.code} type="radio" name="record" label={record.name} checked={record === chosen} onChange={() => setChosen(record)} />
        ))}
      </ChoiceGroup>
      {details === null ? <LoadingLine /> : null}
      {(details ?? []).map((detail) => {
        const fixed = !detail.own && detail.prompt === chosen.titlePrompt;
        return (
          <div className="row" key={detail.prompt}>
            <span className="ttl">{detail.prompt}</span>
            <label className="meta">
              <input type="checkbox" aria-label={`${detail.prompt} on`} checked={detail.on} disabled={fixed} onChange={(event) => change(detail.prompt, { on: event.target.checked, required: event.target.checked && detail.required })} /> On
            </label>
            <label className="meta">
              <input type="checkbox" aria-label={`${detail.prompt} required`} checked={detail.required} disabled={fixed || !detail.on} onChange={(event) => change(detail.prompt, { required: event.target.checked })} /> Required
            </label>
          </div>
        );
      })}
      <Field label="New detail" value={newDetail} onChange={(event) => setNewDetail(event.target.value)} />
      <Button kind="quiet" disabled={newDetail.trim() === "" || taken} onClick={add}>Add detail</Button>
      <p className="meta">Records saved before keep the details they were saved with.</p>
      <Button kind="primary" disabled={details === null} onClick={save}>Save details</Button>
      {saved ? <p className="meta">Details saved.</p> : null}
      {refused ? <LoadFailed words={refused} /> : null}
    </Shell>
  );
}
