import type { PageRow } from "../../types";
import {
  loadScenarios,
  saveAddScenario,
  type ActorDraft,
  type EndpointDraft,
  type InputDraft,
  type Scenario,
} from "../scenario";
import { saveEditScenario } from "../scenarioEdit";
import type { ActionRun, PageModule, Query } from "../types";
import { trimmedValue } from "./groups";

const rows = async (hubId: string, query: Query): Promise<PageRow[]> =>
  (await loadScenarios(hubId, query)).map((scenario) => ({
    id: scenario.id,
    name: scenario.name,
    summary: scenario.summary,
    result: scenario.result,
  }));

const listOfDrafts = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

const addScenario: ActionRun = (hubId, values) =>
  saveAddScenario(hubId, {
    name: trimmedValue(values, "name"),
    summary: trimmedValue(values, "summary"),
    workflowId: trimmedValue(values, "workflow_id"),
    actors: listOfDrafts<ActorDraft>(values.actors),
    inputs: listOfDrafts<InputDraft>(values.inputs),
  });

const editScenario: ActionRun = (hubId, values) =>
  saveEditScenario(hubId, values.scenario as Scenario, {
    name: trimmedValue(values, "name"),
    summary: trimmedValue(values, "summary"),
    actors: listOfDrafts<ActorDraft>(values.actors),
    inputs: listOfDrafts<InputDraft>(values.inputs),
    endpoints: listOfDrafts<EndpointDraft>(values.endpoints),
  });

export const testPage: PageModule = {
  spec: {
    id: "test",
    title: "Test",
    primary: "Run all scenarios",
    tools: [
      "agency_list_scenarios",
      "agency_get_scenario",
      "agency_create_scenario",
      "agency_update_scenario",
      "agency_delete_scenario",
      "agency_add_scenario_actor",
      "agency_rename_scenario_actor",
      "agency_remove_scenario_actor",
      "agency_set_scenario_input",
      "agency_run_scenario",
      "agency_run_scenarios",
      "agency_list_test_runs",
      "agency_list_workflows",
      "agency_list_work_items",
      "agency_list_pickers",
      "agency_list_rules",
    ],
    columns: [
      { key: "name", label: "Scenario" },
      { key: "result", label: "Result" },
    ],
  },
  rows,
  actions: { add: addScenario, edit: editScenario },
};
