import { callTool } from "../wakala/mcp";
import { workingDraftId } from "./draft";
import type { ActorDraft, EndpointDraft, InputDraft, Scenario } from "./scenario";
import type { ActionResult } from "./types";

export type ScenarioEdit = {
  name: string;
  summary: string;
  actors?: ActorDraft[];
  inputs?: InputDraft[];
  endpoints?: EndpointDraft[];
};

export type ScenarioWrite = {
  kind: string;
  summary: string;
  payload: Record<string, unknown>;
};

const normal = (name: string): string => name.trim().toLowerCase();

const inputKey = (input: { stepId: string; field: string }): string =>
  input.stepId + "\u0000" + input.field;

export const duplicateActorName = (
  actors: { name: string }[],
  builtInNames: string[],
): boolean => {
  const names = [...builtInNames, ...actors.map((actor) => actor.name)]
    .map(normal)
    .filter((name) => name !== "");
  return new Set(names).size !== names.length;
};

export const scenariosHoldingRole = (
  scenarios: Scenario[],
  roleId: string,
): string[] =>
  roleId === ""
    ? []
    : scenarios
        .filter((scenario) =>
          scenario.actors.some((actor) => actor.roleId === roleId),
        )
        .map((scenario) => scenario.name);

type ActorEntry = { id?: string; name: string; role_id?: string };

type InputEntry = { step_id: string; field: string; value: string };

const heldEntries = (scenario: Scenario): ActorEntry[] =>
  scenario.actors
    .filter((actor) => !actor.builtIn && actor.id !== "")
    .map((actor) =>
      actorEntry({ id: actor.id, name: actor.name, roleId: actor.roleId }),
    );

const actorEntry = (actor: ActorDraft): ActorEntry => ({
  ...(actor.id ? { id: actor.id } : {}),
  name: actor.name.trim(),
  ...(actor.roleId ? { role_id: actor.roleId } : {}),
});

const fixedEntries = (inputs: InputDraft[]): InputEntry[] =>
  inputs
    .map((input) => ({
      step_id: input.stepId,
      field: input.field,
      value: input.value.trim(),
    }))
    .filter((input) => input.value !== "");

const heldInputs = (scenario: Scenario): InputDraft[] =>
  scenario.blocks.flatMap((block) =>
    block.fields
      .filter((field) => !field.free)
      .map((field) => ({
        stepId: block.stepId,
        field: field.prompt,
        value: field.value,
      })),
  );

type EndpointEntry = { step_id: string; endpoint: string };

const endpointEntries = (endpoints: EndpointDraft[]): EndpointEntry[] =>
  endpoints
    .map((entry) => ({
      step_id: entry.stepId,
      endpoint: entry.endpoint.trim(),
    }))
    .filter((entry) => entry.endpoint !== "")
    .sort((a, b) => a.step_id.localeCompare(b.step_id));

export const heldEndpoints = (scenario: Scenario): EndpointDraft[] =>
  scenario.blocks
    .filter((block) => block.endpoint !== "")
    .map((block) => ({ stepId: block.stepId, endpoint: block.endpoint }));

const sameEntries = <T>(left: T[], right: T[]): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const sameInputs = (left: InputEntry[], right: InputEntry[]): boolean => {
  const sorted = (entries: InputEntry[]) =>
    [...entries].sort((a, b) =>
      inputKey({ stepId: a.step_id, field: a.field }).localeCompare(
        inputKey({ stepId: b.step_id, field: b.field }),
      ),
    );
  return sameEntries(sorted(left), sorted(right));
};

export const scenarioEditWrite = (
  scenario: Scenario,
  edit: ScenarioEdit,
): ScenarioWrite => {
  const name = edit.name.trim();
  if (name === "") throw new Error("name is required");
  const draftedActors = (edit.actors ?? []).filter(
    (actor) => actor.name.trim() !== "",
  );
  if (
    duplicateActorName(
      draftedActors,
      scenario.actors
        .filter((actor) => actor.builtIn)
        .map((actor) => actor.name),
    )
  )
    throw new Error("actor names are unique");
  const actors = draftedActors.map(actorEntry);
  const inputs = fixedEntries(edit.inputs ?? []);
  const actorsChanged =
    edit.actors !== undefined && !sameEntries(actors, heldEntries(scenario));
  const inputsChanged =
    edit.inputs !== undefined &&
    !sameInputs(inputs, fixedEntries(heldInputs(scenario)));
  const endpoints = endpointEntries(edit.endpoints ?? []);
  const endpointsChanged =
    edit.endpoints !== undefined &&
    !sameEntries(endpoints, endpointEntries(heldEndpoints(scenario)));
  return {
    kind: "agency_update_scenario",
    summary: "Change the scenario " + name,
    payload: {
      scenario_id: scenario.id,
      name,
      summary: edit.summary.trim(),
      workflow_id: scenario.workflowId,
      ...(actorsChanged ? { actors } : {}),
      ...(inputsChanged ? { inputs } : {}),
      ...(endpointsChanged ? { endpoints } : {}),
    },
  };
};

export const saveEditScenario = async (
  hubId: string,
  scenario: Scenario,
  edit: ScenarioEdit,
): Promise<ActionResult> => {
  const payload = scenarioEditWrite(scenario, edit).payload;
  const draftId = await workingDraftId(hubId);
  await callTool(hubId, "agency_update_scenario", {
    ...(draftId === "" ? {} : { draft_id: draftId }),
    ...payload,
  });
  return "done";
};
