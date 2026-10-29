import { useEffect, useState } from "react";
import { applyScenarioFill } from "../../data/chatFill";
import type { ScenarioFill } from "../../data/chatAnswer";
import { useI18n } from "../../i18n";
import type { FieldSpec } from "../../types";
import { Button, Card, Field, Row, Stack } from "../../ui";
import {
  loadChoices,
  type ActorDraft,
  type Choices,
  type InputDraft,
} from "../../data/scenario";
import type { Outcome } from "../spec/sendAction";
import { failureOf, sendAction } from "../spec/sendAction";
import { ActorsEditor } from "./ActorsEditor";
import { actorChoices } from "./actorChoices";
import { BlocksEditor } from "./BlocksEditor";
import { namesForRole } from "./namesForRole";
import { useLoaded } from "../../shell/useLoaded";

type Tab = "scenario" | "actors" | "blocks";

type Props = {
  hubId: string;
  fill?: ScenarioFill | null;
  onOutcome: (result: Outcome) => void;
  onCancel: () => void;
};

const choiceFields = (choices: Choices): FieldSpec[] => [
  { name: "name", component: "text", required: true },
  {
    name: "workflow_id",
    component: "select",
    required: true,
    options: choices.workflows.map((workflow) => ({
      value: workflow.id,
      label: workflow.name,
    })),
  },
  { name: "summary", component: "textarea" },
];

export function AddScenarioForm({
  hubId,
  fill = null,
  onOutcome,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const { state } = useLoaded(() => loadChoices(hubId), [hubId]);
  const [tab, setTab] = useState<Tab>("scenario");
  const [name, setName] = useState(fill?.name ?? "");
  const [summary, setSummary] = useState(fill?.summary ?? "");
  const [workflowId, setWorkflowId] = useState("");
  const [actors, setActors] = useState<ActorDraft[]>([]);
  const [inputs, setInputs] = useState<InputDraft[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const choices =
    state.kind === "ready"
      ? state.value
      : { workflows: [], roles: [], groups: [] };

  useEffect(() => {
    if (workflowId === "" && choices.workflows.length > 0)
      setWorkflowId(choices.workflows[0].id);
  }, [choices.workflows.length]);

  useEffect(() => {
    if (!fill || state.kind !== "ready") return;
    const filled = applyScenarioFill(
      fill,
      state.value.workflows,
      state.value.roles,
    );
    if (filled.workflowId !== "") setWorkflowId(filled.workflowId);
    setActors(filled.actors);
  }, [state.kind]);

  const playable = actorChoices(choices, actors);
  const steps =
    choices.workflows.find((workflow) => workflow.id === workflowId)?.steps ??
    [];
  const values: Record<string, string> = {
    name,
    workflow_id: workflowId,
    summary,
  };
  const setters: Record<string, (value: string) => void> = {
    name: setName,
    workflow_id: (value) => {
      setWorkflowId(value);
      setInputs([]);
    },
    summary: setSummary,
  };

  const duplicate = actors.some(
    (actor, index) =>
      actors.findIndex(
        (other) =>
          other.name.trim().toLowerCase() === actor.name.trim().toLowerCase(),
      ) !== index && actor.name.trim() !== "",
  );

  const save = async () => {
    if (name.trim() === "") {
      setError(`${t("required")}: ${t("field.name")}`);
      setTab("scenario");
      return;
    }
    setError("");
    setBusy(true);
    const result = await sendAction("test", "add", hubId, {
      name,
      summary,
      workflow_id: workflowId,
      actors,
      inputs,
    });
    setBusy(false);
    if (result === "failed")
      setError([t("submitFailed"), failureOf()].filter(Boolean).join(" "));
    else onOutcome(result);
  };

  const tabs = (["scenario", "actors", "blocks"] as Tab[]).map((entry) => ({
    to: "#" + entry,
    label: t("test.tab." + entry),
    current: tab === entry,
  }));

  return (
    <Stack gap={16}>
      <nav className="tabs">
        {tabs.map((entry, index) => (
          <button
            key={entry.to}
            type="button"
            className="tab"
            aria-current={entry.current ? "page" : undefined}
            onClick={() =>
              setTab((["scenario", "actors", "blocks"] as Tab[])[index])
            }
          >
            {entry.label}
          </button>
        ))}
      </nav>
      <Card title={t("test.newScenario")}>
        <Stack gap={16}>
          {tab === "scenario"
            ? choiceFields(choices).map((spec) => (
                <Field
                  key={spec.name}
                  spec={spec}
                  value={values[spec.name]}
                  onChange={(value) => setters[spec.name](String(value))}
                />
              ))
            : null}
          {tab === "actors" ? (
            <ActorsEditor
              actors={actors}
              roles={playable}
              duplicate={duplicate}
              onChange={setActors}
            />
          ) : null}
          {tab === "blocks" ? (
            <BlocksEditor
              steps={steps}
              inputs={inputs}
              namesFor={(role) =>
                namesForRole(role, playable, [], actors, choices.groups)
              }
              onChange={setInputs}
            />
          ) : null}
          {error ? (
            <p className="field-error error" role="alert">
              {error}
            </p>
          ) : null}
          <Row>
            <Button disabled={busy || duplicate} onClick={save}>
              {t("test.save")}
            </Button>
            <Button kind="quiet" onClick={onCancel}>
              {t("cancel")}
            </Button>
          </Row>
        </Stack>
      </Card>
    </Stack>
  );
}
