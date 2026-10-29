import { useState } from "react";
import { useI18n } from "../../i18n";
import type { FieldSpec } from "../../types";
import { Button, Field, Note, Row, Stack } from "../../ui";
import {
  loadChoices,
  type ActorDraft,
  type EndpointDraft,
  type InputDraft,
  type Scenario,
} from "../../data/scenario";
import { duplicateActorName, heldEndpoints } from "../../data/scenarioEdit";
import { failureOf, sendAction, type Outcome } from "../spec/sendAction";
import { useLoaded } from "../../shell/useLoaded";
import { ActorsEditor } from "./ActorsEditor";
import { actorChoices } from "./actorChoices";
import { BlocksEditor } from "./BlocksEditor";
import { namesForRole } from "./namesForRole";

type Tab = "scenario" | "actors" | "blocks";

type Props = {
  hubId: string;
  scenario: Scenario;
  onOutcome: (result: Outcome) => void;
  onCancel: () => void;
  tab?: Tab;
};

const tabs: Tab[] = ["scenario", "actors", "blocks"];

const nameField: FieldSpec = {
  name: "name",
  component: "text",
  required: true,
};
const summaryField: FieldSpec = { name: "summary", component: "textarea" };

const heldActors = (scenario: Scenario): ActorDraft[] =>
  scenario.actors
    .filter((actor) => !actor.builtIn)
    .map((actor) => ({ id: actor.id, name: actor.name, roleId: actor.roleId }));

const fixedInputs = (scenario: Scenario): InputDraft[] =>
  scenario.blocks.flatMap((block) =>
    block.fields
      .filter((field) => !field.free)
      .map((field) => ({
        stepId: block.stepId,
        field: field.prompt,
        value: field.value,
      })),
  );

export function EditScenarioForm({
  hubId,
  scenario,
  onOutcome,
  onCancel,
  tab: firstTab = "scenario",
}: Props) {
  const { t } = useI18n();
  const { state } = useLoaded(() => loadChoices(hubId), [hubId]);
  const [tab, setTab] = useState<Tab>(firstTab);
  const [name, setName] = useState(scenario.name);
  const [summary, setSummary] = useState(scenario.summary);
  const [actors, setActors] = useState<ActorDraft[]>(() =>
    heldActors(scenario),
  );
  const [inputs, setInputs] = useState<InputDraft[]>(() =>
    fixedInputs(scenario),
  );
  const [endpoints, setEndpoints] = useState<EndpointDraft[]>(() =>
    heldEndpoints(scenario),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const choices =
    state.kind === "ready"
      ? state.value
      : { workflows: [], roles: [], groups: [] };
  const steps =
    choices.workflows.find((workflow) => workflow.id === scenario.workflowId)
      ?.steps ?? [];
  const builtIn = scenario.actors
    .filter((actor) => actor.builtIn)
    .map((actor) => actor.name);
  const playable = actorChoices(choices, actors);
  const namesFor = (role: string) =>
    namesForRole(
      role,
      playable,
      scenario.actors.filter((actor) => actor.builtIn),
      actors,
      choices.groups,
    );
  const duplicate = duplicateActorName(actors, builtIn);
  const workflowField: FieldSpec = {
    name: "workflow_id",
    component: "select",
    options: [{ value: scenario.workflowId, label: scenario.workflow }],
  };

  const save = async () => {
    if (name.trim() === "") {
      setError(`${t("required")}: ${t("field.name")}`);
      setTab("scenario");
      return;
    }
    setError("");
    setBusy(true);
    const result = await sendAction("test", "edit", hubId, {
      scenario,
      name,
      summary,
      actors,
      inputs,
      endpoints,
    });
    setBusy(false);
    if (result === "failed")
      setError([t("submitFailed"), failureOf()].filter(Boolean).join(" "));
    else onOutcome(result);
  };

  return (
    <Stack gap={16}>
      <nav className="tabs">
        {tabs.map((entry) => (
          <button
            key={entry}
            type="button"
            className="tab"
            aria-current={tab === entry ? "page" : undefined}
            onClick={() => setTab(entry)}
          >
            {t("test.tab." + entry)}
          </button>
        ))}
      </nav>
      <Stack gap={16}>
        {tab === "scenario" ? (
          <>
            <Field
              spec={nameField}
              value={name}
              onChange={(value) => setName(String(value))}
            />
            <Field
              spec={workflowField}
              value={scenario.workflowId}
              disabled
              onChange={() => {}}
            />
            <Field
              spec={summaryField}
              value={summary}
              onChange={(value) => setSummary(String(value))}
            />
          </>
        ) : null}
        {tab === "actors" ? (
          <ActorsEditor
            actors={actors}
            roles={playable}
            duplicate={duplicate}
            builtIn={builtIn}
            note={t("test.roleHeld")}
            onChange={setActors}
          />
        ) : null}
        {tab === "blocks" ? (
          <BlocksEditor
            steps={steps}
            inputs={inputs}
            namesFor={namesFor}
            onChange={setInputs}
            blocks={scenario.blocks}
            endpoints={endpoints}
            onEndpoints={setEndpoints}
          />
        ) : null}
        <Note>{t("test.editHint")}</Note>
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
    </Stack>
  );
}
