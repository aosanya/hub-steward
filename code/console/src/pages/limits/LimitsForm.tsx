import { useState } from "react";
import { heldLimitKeys, saveModelLimits, type HeldLimitKey, type HeldLimits, type ModelAccount } from "../../data/modelLimits";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Button, Card, SettingRows, Toggle, useNotice } from "../../ui";
import { NumberControl } from "../agent/NumberControl";

const limitsTool = "ai_set_limits";

type Setting = { applies: boolean; digits: string };
type Settings = Record<HeldLimitKey, Setting>;

const settingsOf = (values: HeldLimits): Settings =>
  Object.fromEntries(heldLimitKeys.map((key) => [key, { applies: values[key] !== null, digits: String(values[key] ?? 0) }])) as Settings;

const valuesOf = (settings: Settings): HeldLimits =>
  Object.fromEntries(heldLimitKeys.map((key) => [key, settings[key].applies ? Number(settings[key].digits || 0) : null])) as HeldLimits;

export function LimitsForm({ account }: { account: ModelAccount }) {
  const { t } = useI18n();
  const { hub } = useConsole();
  const { show } = useNotice();
  const [saved, setSaved] = useState(account.limits);
  const [settings, setSettings] = useState(() => settingsOf(account.limits));
  const [busy, setBusy] = useState(false);

  const change = (key: HeldLimitKey, setting: Setting) => setSettings({ ...settings, [key]: setting });

  const save = async () => {
    const values = valuesOf(settings);
    setBusy(true);
    const ok = await saveModelLimits(hub.id, account.id, values).then(
      () => true,
      () => false,
    );
    setBusy(false);
    if (ok) {
      setSaved(values);
      show(t("notice.limitsSaved"));
    } else {
      show(t("submitFailed"), "bad");
    }
  };

  const cancel = () => setSettings(settingsOf(saved));

  const rows = heldLimitKeys.map((key) => {
    const label = t(`limits.${key}`);
    return {
      label,
      control: (
        <div className="applies">
          <NumberControl
            label={label}
            digits={settings[key].digits}
            applies={settings[key].applies}
            onChange={(digits) => change(key, { ...settings[key], digits })}
          />
          <Toggle label={t("agentApplies")} on={settings[key].applies} onChange={(applies) => change(key, { ...settings[key], applies })} />
        </div>
      ),
    };
  });

  return (
    <Card>
      <span className="form-tool">{limitsTool}</span>
      <SettingRows rows={rows} />
      <div className="form-foot">
        <Button disabled={busy} onClick={save}>
          {t("limits.save")}
        </Button>
        <Button kind="quiet" onClick={cancel}>
          {t("cancel")}
        </Button>
      </div>
    </Card>
  );
}
