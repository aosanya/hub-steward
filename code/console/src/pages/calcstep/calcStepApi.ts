import { textOf, type Item } from "../../data/pages/groups";
import { callTool } from "../../wakala/mcp";
import { fixtureChoice, fixtureFunctions } from "./calcStepFixture";

export type FunctionVersions = { name: string; versions: number[]; about: string };

export type FunctionChoice = { name: string; version: number };

export type StepHeader = { id: string; code: string; title: string };

export type CalcStepApi = {
  openStep: (hubId: string, stepId: string) => Promise<StepHeader>;
  listFunctions: (hubId: string) => Promise<FunctionVersions[]>;
  chosenFunction: (hubId: string, stepId: string) => Promise<FunctionChoice | null>;
};

export const written = (choice: FunctionChoice) => `${choice.name}@${choice.version}`;

export const newestOf = (functionVersions: FunctionVersions) => Math.max(...functionVersions.versions);

export const calcStepApi: CalcStepApi = {
  openStep: async (hubId, stepId) => {
    const step = await callTool<Item>(hubId, "agency_get_work_item", { work_item_id: stepId });
    return { id: textOf(step, "id") || stepId, code: textOf(step, "code"), title: textOf(step, "title") };
  },
  listFunctions: async () => fixtureFunctions,
  chosenFunction: async () => fixtureChoice,
};
