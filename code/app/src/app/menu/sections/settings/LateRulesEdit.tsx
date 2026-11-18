import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMay } from "../../../../features/agency/useMay";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { SearchSelect } from "../../../../shared/ui/SearchSelect";
import { callTool } from "../../../../shared/wakala/mcp";
import { Shell } from "../../../Shell";
import { loadFailedWords } from "../../MenuDetail";
import { refusalWords } from "../../MenuEditForm";
import { lateRuleKey } from "../finance/financeData";
import { openRoleChoices } from "../../roleKinds";
import { changedOf, problemOf, ruleValue, type LateRulesView } from "./lateRulesData";
import { settingsPaths } from "./paths";
import { useLateRules } from "./useLateRules";

type Entry = { days: string; role: string };

const writeTool = "forms_catalog_setting_write";

function LateRulesForm({ view, done }: { view: LateRulesView; done: () => void }) {
  const [entries, setEntries] = useState<Record<string, Entry>>(Object.fromEntries(view.charges.map((charge) => [charge.id, { days: charge.days, role: charge.role }])));
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const change = (id: string, patch: Partial<Entry>) => setEntries((was) => ({ ...was, [id]: { ...was[id], ...patch } }));
  const problems = view.charges.map((charge) => problemOf(charge, entries[charge.id]));
  const changed = view.charges.filter((charge) => changedOf(charge, entries[charge.id]));
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      for (const charge of changed) await callTool("", writeTool, { key: lateRuleKey(charge.id), value: ruleValue(entries[charge.id]) });
      done();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      {view.charges.map((charge, at) => (
        <div key={charge.id} className="sec-tools">
          <Field label={`${charge.name} days`} value={entries[charge.id].days} error={problems[at] || undefined} onChange={(event) => change(charge.id, { days: event.target.value })} />
          <SearchSelect label={`${charge.name} role`} choices={openRoleChoices(view.kinds)} value={entries[charge.id].role} onChange={(role) => change(charge.id, { role })} />
        </div>
      ))}
      <Button kind="primary" disabled={saving || changed.length === 0 || problems.some((problem) => problem !== "")} onClick={save}>Save</Button>
      <Button kind="quiet" disabled={saving} onClick={done}>Cancel</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}

export function LateRulesEdit() {
  const navigate = useNavigate();
  const may = useMay("permission.override");
  const { view, retry } = useLateRules("late-rules-edit");
  const back = () => navigate(settingsPaths.lateRules.path());
  return (
    <Shell title="Edit late rules" titleUnder onBack={back} backLabel="Late rules" tabless>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words={loadFailedWords} onRetry={retry} /> : null}
      {view.state === "ready" && may ? <div className="person-page"><LateRulesForm view={view.data} done={back} /></div> : null}
    </Shell>
  );
}
