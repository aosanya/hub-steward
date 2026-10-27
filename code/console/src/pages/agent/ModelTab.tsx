import { useState } from "react";
import { useI18n } from "../../i18n";
import { Card, Empty, SelectControl, SettingRows, Stack, Tile } from "../../ui";
import { saveAgentModel, type AgentRow, type AgentRows, type ModelOption } from "../../data/agent";
import { accountTitleOf } from "../models/accountMap";
import { AgentFrame } from "./AgentFrame";
import { StoppedAsk } from "./StoppedAsk";
import type { Loaded } from "../../shell/useLoaded";
import { useAgentSave } from "./useAgentSave";

const labelOf = (t: Parameters<typeof accountTitleOf>[0], option: ModelOption) =>
  option.modelName ? accountTitleOf(t, { provider: option.provider ?? "", baseUrl: option.baseUrl ?? "", modelName: option.modelName }) : option.label;

function ModelForm({ role, row }: { role: string; row: AgentRow }) {
  const { t } = useI18n();
  const [accountId, setAccountId] = useState(row.account_id ?? "");
  const { save } = useAgentSave(role, saveAgentModel);
  const unset = !row.account_id;
  const models = (row.options ?? []).map((option) => ({ value: option.id, label: labelOf(t, option) }));
  const options = unset ? [{ value: "", label: t("models.choose") }, ...models] : models;

  return (
    <AgentFrame primary={{ label: t("agentSaveChanges"), onClick: () => save(accountId) }}>
      <StoppedAsk role={role} />
      <Stack>
        {unset ? <Tile label="" value={t("agent.noModel")} state="warn" /> : null}
        <Card>
          <SettingRows
            rows={[
              {
                label: t("agentModel"),
                control: <SelectControl label={t("agentModel")} value={accountId} options={options} onChange={setAccountId} />,
              },
            ]}
          />
        </Card>
      </Stack>
    </AgentFrame>
  );
}

export function ModelTab({ role, agent }: { role: string; agent: Loaded<AgentRows> }) {
  const { t } = useI18n();
  if (agent.kind === "loading") return <AgentFrame />;
  if (agent.kind === "failed") {
    return (
      <AgentFrame>
        <Empty failed text={t("loadFailed")} />
      </AgentFrame>
    );
  }
  const row = agent.value.rows?.[0];
  if (!row) {
    return (
      <AgentFrame>
        <Empty text={t("noRows")} />
      </AgentFrame>
    );
  }
  return <ModelForm role={role} row={row} />;
}
