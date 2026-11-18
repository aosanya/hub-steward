import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { itemsOf } from "../../../../features/backlogs";
import { useMay } from "../../../../features/agency/useMay";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { refusalWords } from "../../MenuEditForm";
import { agentLimitFields, everyoneId, limitsPermission, personLimitFields, type LimitField } from "./aiLimits";
import { settingsPaths } from "./paths";

type Record_ = Record<string, unknown>;

const wholeNumber = /^\d+$/;

const badNumberWords = "Use whole numbers, 0 or more. Zero means no limit.";

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const shown = (value: unknown) => String(typeof value === "number" && value > 0 ? value : 0);

const loadSubject = async (id: string): Promise<Record_> => {
  if (id === everyoneId) return (await callTool("", "ai_get_assistant_limits")) as Record_;
  return (itemsOf(await callTool("", "ai_list_roles")).find((entry) => textOf(entry.id) === id) ?? {}) as Record_;
};

const numbersOf = (fields: LimitField[], values: Record<string, string>) => {
  const parsed = fields.map(([key]) => [key, values[key].trim() === "" ? "0" : values[key].trim()] as const);
  return parsed.every(([, value]) => wholeNumber.test(value)) ? Object.fromEntries(parsed.map(([key, value]) => [key, Number(value)])) : null;
};

function LimitsForm({ id, subject, done }: { id: string; subject: Record_; done: () => void }) {
  const fields = id === everyoneId ? personLimitFields : agentLimitFields;
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(([key]) => [key, shown(subject[key])])));
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const save = async () => {
    const numbers = numbersOf(fields, values);
    if (!numbers) {
      setRefused(badNumberWords);
      return;
    }
    setSaving(true);
    setRefused("");
    try {
      if (id === everyoneId) await callTool("", "ai_set_assistant_limits", numbers);
      else await callTool("", "ai_set_role_limits", { roleID: id, ...numbers });
      done();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      {fields.map(([key, label]) => (
        <Field key={key} label={label} inputMode="numeric" value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
      ))}
      {refused ? <LoadFailed words={refused} /> : null}
      <Button kind="primary" disabled={saving} onClick={save}>Save</Button>
      <Button kind="quiet" disabled={saving} onClick={done}>Cancel</Button>
    </>
  );
}

export function AiLimitsEditScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const may = useMay(limitsPermission(id));
  const view = useLoad(() => loadSubject(id), `ai-limits-edit:${openAgencyId()}:${id}`);
  const back = () => navigate(settingsPaths.aiAgents.path({ item: id }));
  const name = id === everyoneId ? "Each person" : view.state === "ready" ? textOf(view.data.name) : "";
  return (
    <Shell title="Edit limits" titleUnder onBack={back} backLabel={name || "Back"} tabless>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="This could not be loaded." /> : null}
      {view.state === "ready" && may ? <div className="person-page"><LimitsForm id={id} subject={view.data} done={back} /></div> : null}
    </Shell>
  );
}
