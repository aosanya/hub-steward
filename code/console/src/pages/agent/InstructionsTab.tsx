import { useState } from "react";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Button, Card, Empty, Icon, Stack, Toggle } from "../../ui";
import { agentInstructions, saveAgentInstructions, type InstructionPart, type InstructionsReply } from "../../data/agent";
import { AgentFrame } from "./AgentFrame";
import { agencyPartsOf, assemblePreview } from "./preview";
import { Revisions } from "./Revisions";
import { useAgentSave } from "./useAgentSave";
import { useLoaded } from "../../shell/useLoaded";

type AgencyCardProps = { parts: InstructionPart[]; useAgency: boolean };

function AgencyCard({ parts, useAgency }: AgencyCardProps) {
  const { t } = useI18n();
  const shown = agencyPartsOf(parts);
  return (
    <Card title={t("agent.instrAgencyCard")}>
      {!useAgency ? <p className="muted">{t("agent.instrNotUsed")}</p> : null}
      {useAgency && shown.length === 0 ? <p className="muted">{t("agent.instrNoAgency")}</p> : null}
      {useAgency
        ? shown.map((part, index) => (
            <div className="field" key={index}>
              <span className="field-label">{t("instrSource." + part.source)}</span>
              <div className="field-value instr-text">{part.text}</div>
            </div>
          ))
        : null}
    </Card>
  );
}

type FineTuningFormProps = {
  fineTuning: string;
  useAgency: boolean;
  onFineTuning: (value: string) => void;
  onUseAgency: (value: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
};

function FineTuningForm({ fineTuning, useAgency, onFineTuning, onUseAgency, onSave, onCancel }: FineTuningFormProps) {
  const { t } = useI18n();
  return (
    <div className="msg-card">
      <div className="msg-title">
        <Icon name="edit" size={16} />
        {t("agent.instrYours")}
      </div>
      <div className="msg-form">
        <Toggle label={t("instrUseAgency")} on={useAgency} onChange={onUseAgency} />
        <label className="field">
          <span className="field-label">{t("instrFineTuning")}</span>
          <span className="control">
            <textarea value={fineTuning} onChange={(e) => onFineTuning(e.target.value)} />
          </span>
        </label>
      </div>
      <div className="msg-buttons">
        <Button size="sm" onClick={onSave}>
          {t("save")}
        </Button>
        <Button kind="quiet" size="sm" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
      <div className="msg-note">{t("agent.instrNothingRecorded")}</div>
    </div>
  );
}

type InstructionsFormProps = { role: string; reply: InstructionsReply; reload: () => void };

function InstructionsForm({ role, reply, reload }: InstructionsFormProps) {
  const { t } = useI18n();
  const parts = reply.parts ?? [];
  const savedFineTuning = reply.fine_tuning ?? "";
  const savedUseAgency = Boolean(reply.use_agency_instructions);
  const [fineTuning, setFineTuning] = useState(savedFineTuning);
  const [useAgency, setUseAgency] = useState(savedUseAgency);
  const { save, reportFailure } = useAgentSave(role, saveAgentInstructions);
  const preview = assemblePreview(parts, useAgency, fineTuning);
  const both = preview.agency.length > 0;

  const cancel = () => {
    setFineTuning(savedFineTuning);
    setUseAgency(savedUseAgency);
  };

  return (
    <AgentFrame>
      <Revisions role={role} onRestored={reload} onRestoreFailed={reportFailure} />
      <Stack gap={20}>
        <AgencyCard parts={parts} useAgency={useAgency} />
        <FineTuningForm
          fineTuning={fineTuning}
          useAgency={useAgency}
          onFineTuning={setFineTuning}
          onUseAgency={setUseAgency}
          onSave={() => save({ fine_tuning: fineTuning, use_agency_instructions: useAgency })}
          onCancel={cancel}
        />
        <Card title={t(both ? "agent.previewBoth" : "agent.previewAlone")}>
          {preview.agency.map((text, index) => (
            <p className="soft instr-text" key={"agency" + index}>
              {text}
            </p>
          ))}
          {preview.own.map((text, index) => (
            <p className="instr-text" key={"own" + index}>
              {text}
            </p>
          ))}
        </Card>
      </Stack>
    </AgentFrame>
  );
}

export function InstructionsTab({ role }: { role: string }) {
  const { hub } = useConsole();
  const { t } = useI18n();
  const { state: instructions, reload, received } = useLoaded<InstructionsReply>(() => agentInstructions(hub.id, role), [hub.id, role]);
  if (instructions.kind === "loading") return <AgentFrame />;
  if (instructions.kind === "failed") {
    return (
      <AgentFrame>
        <Empty failed text={t("loadFailed")} />
      </AgentFrame>
    );
  }
  return <InstructionsForm key={received} role={role} reply={instructions.value} reload={reload} />;
}
