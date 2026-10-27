import { useState } from "react";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Button, Card, Empty, Toggle } from "../../ui";
import { agentLimits, saveAgentLimits, type LimitRow, type LimitRows } from "../../data/agent";
import { AgentFrame } from "./AgentFrame";
import { NumberControl } from "./NumberControl";
import { StoppedAsk } from "./StoppedAsk";
import { useAgentSave } from "./useAgentSave";
import { useLoaded } from "../../shell/useLoaded";

const limitsTool = "ai_set_limits";
const noLimitSource = "none";

type Setting = { applies: boolean; digits: string };
type Settings = Record<string, Setting>;

const limitDefaults: Record<string, number> = {
  tokens_per_call: 8000,
  tokens_per_day: 200000,
  tokens_per_week: 1000000,
  tokens_per_month: 4000000,
  requests_per_minute: 30,
  requests_per_day: 1500,
  requests_per_week: 7500,
};

const defaultOf = (row: LimitRow): number => {
  const wanted = limitDefaults[row.key] ?? 0;
  const ceiling = Number(row.ceiling);
  return ceiling > 0 ? Math.min(wanted, ceiling) : wanted;
};

const startingSettings = (rows: LimitRow[]): Settings =>
  Object.fromEntries(
    rows.map((row) => {
      const applies = row.role_limit !== null && row.role_limit !== undefined;
      return [row.key, { applies, digits: String(applies ? row.role_limit : defaultOf(row)) }];
    }),
  );

const payloadOf = (settings: Settings) =>
  Object.fromEntries(
    Object.entries(settings).map(([key, setting]) => [key, setting.applies ? Number(setting.digits || 0) : null]),
  );

const hasCeiling = (value: LimitRow["ceiling"]) => Number(value) > 0;

const limitOrder = [
  "tokens_per_call",
  "tokens_per_day",
  "tokens_per_week",
  "tokens_per_month",
  "requests_per_minute",
  "requests_per_day",
  "requests_per_week",
];

const rankOf = (row: LimitRow) => {
  const rank = limitOrder.indexOf(row.key);
  return rank < 0 ? limitOrder.length : rank;
};

const inDesignOrder = (rows: LimitRow[]) => [...rows].sort((a, b) => rankOf(a) - rankOf(b));

type LimitSettingRowProps = { row: LimitRow; setting: Setting; onChange: (setting: Setting) => void };

function LimitSettingRow({ row, setting, onChange }: LimitSettingRowProps) {
  const { t, lang } = useI18n();
  const count = (value: LimitRow["ceiling"]) => (typeof value === "number" ? value.toLocaleString(lang) : String(value ?? ""));

  return (
    <div className="setting">
      <span className="setting-label">
        {row.label}
        {hasCeiling(row.ceiling) ? (
          <>
            <br />
            <span className="muted">{t("agent.modelMax").replace("{max}", count(row.ceiling))}</span>
          </>
        ) : null}
        {row.source === noLimitSource ? null : (
          <>
            <br />
            <span className="muted">
              {t("agent.inForceUsed").replace("{force}", count(row.in_force)).replace("{used}", count(row.used))}
            </span>
          </>
        )}
      </span>
      <div className="setting-control">
        <div className="applies">
          <NumberControl
            label={row.label}
            digits={setting.digits}
            applies={setting.applies}
            onChange={(digits) => onChange({ ...setting, digits })}
          />
          <Toggle label={t("agentApplies")} on={setting.applies} onChange={(applies) => onChange({ ...setting, applies })} />
        </div>
      </div>
    </div>
  );
}

function LimitsForm({ role, rows }: { role: string; rows: LimitRow[] }) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<Settings>(() => startingSettings(rows));
  const { save } = useAgentSave(role, saveAgentLimits);

  const change = (key: string, setting: Setting) => setSettings({ ...settings, [key]: setting });

  return (
    <AgentFrame>
      <StoppedAsk role={role} />
      <Card>
        <span className="form-tool">{limitsTool}</span>
        <div className="settings">
          {inDesignOrder(rows).map((row) => (
            <LimitSettingRow key={row.key} row={row} setting={settings[row.key]} onChange={(setting) => change(row.key, setting)} />
          ))}
        </div>
        <p className="muted">{t("agentZeroNone")}</p>
        <div className="form-foot">
          <Button onClick={() => save(payloadOf(settings))}>{t("agentSaveChanges")}</Button>
          <Button kind="quiet" onClick={() => setSettings(startingSettings(rows))}>
            {t("cancel")}
          </Button>
        </div>
      </Card>
    </AgentFrame>
  );
}

export function LimitsTab({ role }: { role: string }) {
  const { hub } = useConsole();
  const { t } = useI18n();
  const { state: limits } = useLoaded<LimitRows>(() => agentLimits(hub.id, role), [hub.id, role]);
  if (limits.kind === "loading") return <AgentFrame />;
  if (limits.kind === "failed") {
    return (
      <AgentFrame>
        <Empty failed text={t("loadFailed")} />
      </AgentFrame>
    );
  }
  return <LimitsForm role={role} rows={limits.value.rows ?? []} />;
}
