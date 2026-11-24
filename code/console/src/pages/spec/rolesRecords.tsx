import { useId, useState } from "react";
import {
  loadRecordPermissions,
  permissionChange,
  recordPermissionActions,
  recordPermissionCode,
  type PermissionRecord,
  type RecordPermissionSet,
} from "../../data/pages/recordPermissions";
import { useI18n } from "../../i18n";
import { useLoaded } from "../../shell/useLoaded";
import { Button, Card, SettingRows } from "../../ui";
import { OptionControl } from "../../ui/fieldControls";
import { sendAction, type Outcome } from "./sendAction";

const actionWords = { add: "roles.recordAdd", edit: "roles.recordEdit", delete: "roles.recordDelete", view: "roles.recordView" } as const;

type RecordTicksProps = { hubId: string; roleId: string; set: RecordPermissionSet; onOutcome: (result: Outcome) => void; onSaved: () => void };

function RecordTicks({ hubId, roleId, set, onOutcome, onSaved }: RecordTicksProps) {
  const { t } = useI18n();
  const ids = useId();
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set(set.held));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const change = permissionChange(set, ticked);
  const unchanged = change.add.length + change.remove.length === 0;
  const flip = (code: string) =>
    setTicked((before) => {
      const next = new Set(before);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  const save = async () => {
    setBusy(true);
    setProblem("");
    const result = await sendAction("roles", "recordPermissions", hubId, { role_id: roleId, ...change });
    setBusy(false);
    if (result === "failed") return setProblem(t("submitFailed"));
    onOutcome(result);
    if (result === "done") onSaved();
  };
  const row = (record: PermissionRecord) => {
    const labelId = `${ids}-${record.code}`;
    const item = record.itemName && record.itemName.toLowerCase() !== record.name.toLowerCase() ? record.itemName : "";
    return {
      label: (
        <>
          <span id={labelId}>{record.name || record.code}</span>
          {item ? <span className="count"> {item}</span> : null}
        </>
      ),
      control: (
        <OptionControl
          name={labelId}
          labelledBy={labelId}
          multiple
          off={busy}
          options={recordPermissionActions.map((action) => ({ value: recordPermissionCode(record.code, action), label: t(actionWords[action]) }))}
          isOn={(option) => ticked.has(option.value)}
          onPick={(option) => flip(option.value)}
        />
      ),
    };
  };
  return (
    <Card
      title={t("roles.records")}
      footer={
        <>
          {problem ? (
            <p className="field-error error" role="alert">
              {problem}
            </p>
          ) : null}
          <Button size="sm" disabled={busy || unchanged} onClick={save}>
            {t("roles.recordsSave")}
          </Button>
        </>
      }
    >
      <SettingRows rows={set.records.map(row)} />
    </Card>
  );
}

type RecordPermissionsProps = { hubId: string; roleId: string; onOutcome: (result: Outcome) => void };

export function RecordPermissions({ hubId, roleId, onOutcome }: RecordPermissionsProps) {
  const { state, reload, received } = useLoaded(() => loadRecordPermissions(hubId, roleId), [hubId, roleId]);
  if (state.kind !== "ready" || state.value.records.length === 0) return null;
  return <RecordTicks key={received} hubId={hubId} roleId={roleId} set={state.value} onOutcome={onOutcome} onSaved={reload} />;
}
