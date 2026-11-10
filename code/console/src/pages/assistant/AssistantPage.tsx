import { useState } from "react";
import { loadAssistantSettings, saveAssistantSettings, type AssistantSettings } from "../../data/assistantLimits";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { useLoaded } from "../../shell/useLoaded";
import { Button, Card, Empty, SettingRows, Stack, TitleRow, Toggle, useNotice } from "../../ui";
import { NumberControl } from "../agent/NumberControl";

type Digits = { applies: boolean; digits: string };

type LimitKey = "day" | "month" | "ownerDay" | "ownerMonth";

type Form = { settings: AssistantSettings; digits: Record<LimitKey, Digits> };

const limitKeys: LimitKey[] = ["day", "month", "ownerDay", "ownerMonth"];

const digitsOf = (value: number | null): Digits => ({ applies: value !== null, digits: String(value ?? 0) });

const formOf = (settings: AssistantSettings): Form => ({
  settings,
  digits: Object.fromEntries(limitKeys.map((key) => [key, digitsOf(settings.limits[key])])) as Record<LimitKey, Digits>,
});

const valueOf = ({ applies, digits }: Digits): number | null => (applies ? Number(digits || 0) : null);

const settingsOf = (form: Form): AssistantSettings => ({
  ...form.settings,
  limits: Object.fromEntries(limitKeys.map((key) => [key, valueOf(form.digits[key])])) as AssistantSettings["limits"],
});

function AssistantForm({ held }: { held: AssistantSettings }) {
  const { t } = useI18n();
  const { hub, refreshMenu } = useConsole();
  const { show } = useNotice();
  const [saved, setSaved] = useState(held);
  const [switchesSaved, setSwitchesSaved] = useState(false);
  const [form, setForm] = useState(() => formOf(held));
  const [busy, setBusy] = useState(false);

  const switchRole = (id: string, may: boolean) =>
    setForm({ ...form, settings: { ...form.settings, roles: form.settings.roles.map((role) => (role.id === id ? { ...role, may } : role)) } });

  const save = async () => {
    const after = settingsOf(form);
    setBusy(true);
    const ok = await saveAssistantSettings(hub.id, saved, after).then(
      () => true,
      () => false,
    );
    setBusy(false);
    if (!ok) return show(t("submitFailed"), "bad");
    setSwitchesSaved(after.roles.some((role) => saved.roles.find((held) => held.id === role.id)?.may !== role.may));
    setSaved(after);
    refreshMenu();
    show(t("assistant.saved"));
  };

  const setDigits = (key: LimitKey, change: Partial<Digits>) => setForm({ ...form, digits: { ...form.digits, [key]: { ...form.digits[key], ...change } } });

  const numberRow = (label: string, key: LimitKey) => ({
    label,
    control: (
      <div className="applies">
        <NumberControl label={label} digits={form.digits[key].digits} applies={form.digits[key].applies} onChange={(digits) => setDigits(key, { digits })} />
        <Toggle label={t("agentApplies")} on={form.digits[key].applies} onChange={(applies) => setDigits(key, { applies })} />
      </div>
    ),
  });

  const roleRows = form.settings.roles.map((role) => ({
    label: role.name,
    control: <Toggle label={t("assistant.mayAsk")} on={role.may} onChange={(may) => switchRole(role.id, may)} />,
  }));

  return (
    <Stack>
      <Card title={t("assistant.who")}>{roleRows.length === 0 ? <Empty text={t("assistant.noRoles")} /> : <SettingRows rows={roleRows} />}</Card>
      <Card title={t("assistant.share")}>
        <SettingRows
          rows={[
            numberRow(t("assistant.tokensDay"), "day"),
            numberRow(t("assistant.tokensMonth"), "month"),
            numberRow(t("assistant.ownerTokensDay"), "ownerDay"),
            numberRow(t("assistant.ownerTokensMonth"), "ownerMonth"),
          ]}
        />
      </Card>
      <div className="form-foot">
        <Button disabled={busy} onClick={save}>
          {t("assistant.save")}
        </Button>
        <Button kind="quiet" onClick={() => setForm(formOf(saved))}>
          {t("cancel")}
        </Button>
      </div>
      {switchesSaved ? <p className="muted">{t("assistant.publishNeeded")}</p> : null}
    </Stack>
  );
}

export function AssistantPage() {
  const { t } = useI18n();
  const { hub } = useConsole();
  const { state } = useLoaded(() => loadAssistantSettings(hub.id), [hub.id]);

  return (
    <>
      <TitleRow title={t("menu.assistant")} />
      {state.kind === "failed" ? <Empty failed text={t("loadFailed")} /> : null}
      {state.kind === "ready" ? <AssistantForm key={hub.id} held={state.value} /> : null}
    </>
  );
}
