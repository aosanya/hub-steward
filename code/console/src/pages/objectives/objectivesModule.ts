import type { PageModule } from "../../data/types";
import { addObjective } from "./objectiveAddWrite";
import { objectiveRows, setMeasure } from "./objectivesData";

export const objectivesPage: PageModule = {
  spec: {
    id: "objectives",
    title: "Objectives",
    primary: "Add an objective",
    tools: [
      "agency_list_objectives",
      "agency_list_goals",
      "agency_list_workflow_objectives",
      "agency_list_workflows",
      "agency_list_work_items",
      "agency_list_measures",
      "agency_get_objective",
      "agency_get_work_item",
      "agency_get_workflow",
      "agency_list_roles",
      "agency_list_role_assignments_for_work_item",
      "agency_create_objective",
      "agency_link_workflow_objective",
      "agency_set_measure",
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "title", label: "Objective" },
      { key: "goal", label: "Goal" },
      { key: "workflows", label: "Workflows" },
      { key: "measure", label: "Measure" },
    ],
  },
  rows: objectiveRows,
  actions: { add: addObjective, setMeasure },
};
