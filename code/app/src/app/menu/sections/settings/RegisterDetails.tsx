import { useEffect, useState } from "react";
import { Field } from "../../../../shared/ui/Field";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { Shell } from "../../../Shell";
import { refusalWords } from "../../MenuEditForm";
import { resolveRecordCode } from "../../liveRecordRows";
import { PageFrame } from "../../PageFrame";
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
import { useChatAboutSubject } from "../residents/SubjectChat";
import { settingsPaths } from "./paths";

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
  const [kept, setKept] = useState("");
  useEffect(() => {
    let live = true;
    setKept("");
    resolveRecordCode(chosen.code).then((code) => live && setKept(code));
    return () => {
      live = false;
    };
  }, [chosen]);
  const onPage = (detail: RegisterDetail) => `${detail.prompt} (${detail.on ? (detail.required ? "on, required" : "on") : "off"})`;
  useChatAboutSubject(details === null || kept === "" ? null : { kind: "record-details", id: kept, name: chosen.name, extra: { details: details.map(onPage).join("; ") } }, settingsPaths.registerDetails.path());
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
  const toggles = (detail: RegisterDetail, fixed: boolean) => (
    <>
      <label className="chip">
        <input type="checkbox" aria-label={`${detail.prompt} on`} checked={detail.on} disabled={fixed} onChange={(event) => change(detail.prompt, { on: event.target.checked, required: event.target.checked && detail.required })} /> On
      </label>
      <label className="chip">
        <input type="checkbox" aria-label={`${detail.prompt} required`} checked={detail.required} disabled={fixed || !detail.on} onChange={(event) => change(detail.prompt, { required: event.target.checked })} /> Required
      </label>
    </>
  );
  const rows = [
    <div key="records" className="sec-tools">
      <div className="sec-tabs" role="tablist" aria-label="Record">
        {records.map((record) => (
          <button key={record.code} type="button" role="tab" aria-selected={record === chosen} onClick={() => setChosen(record)}>
            {record.name}
          </button>
        ))}
      </div>
    </div>,
    ...(details === null ? [<LoadingLine key="loading" />] : []),
    ...(details ?? []).map((detail) => {
      const fixed = !detail.own && detail.prompt === chosen.titlePrompt;
      return <ListRow key={detail.prompt} title={detail.prompt} meta={fixed ? "Always on and required" : undefined} end={toggles(detail, fixed)} />;
    }),
    <div key="new" className="sec-tools">
      <Field label="New detail" value={newDetail} onChange={(event) => setNewDetail(event.target.value)} />
      <p className="meta">Records saved before keep the details they were saved with.</p>
      {saved ? <p className="meta">Details saved.</p> : null}
      {refused ? <LoadFailed words={refused} /> : null}
    </div>,
  ];
  return (
    <Shell title="Details of a record" onBack={back.onBack} backLabel={back.backLabel}>
      <PageFrame title="Details of a record">
        <Section
          word="Details"
          plain
          total={details?.length ?? 0}
          rows={rows}
          foot={
            <>
              <button type="button" className="sec-foot-item" disabled={newDetail.trim() === "" || taken} onClick={add}>Add detail</button>
              <button type="button" className="sec-act" disabled={details === null} onClick={save}>Save details</button>
            </>
          }
        />
      </PageFrame>
    </Shell>
  );
}
