import type { ToolInfo } from "../wakala/mcp";
import { chatPageOf } from "./chatPages";

export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

const maxDescription = 200;

const maxPropertyDescription = 100;

const agencyFamily = ["agency_", "instance_"];

const peopleFamily = ["actor_", "agency_list_roles"];

const groupReads = [
  "actor_list_groups",
  "actor_get_group",
  "actor_list_join_requests_for_group",
  "actor_list_actors_for_group",
];

const operationsFamily = ["comm_", "insight_", "actor_list_groups"];

const families: Record<string, string[]> = {
  status: [
    "ai_",
    "agency_get_agency",
    "agency_list_roles",
    "agency_list_drafts",
    "instance_",
  ],
  profile: agencyFamily,
  goals: agencyFamily,
  objectives: agencyFamily,
  roles: agencyFamily,
  risks: agencyFamily,
  bowties: agencyFamily,
  modules: agencyFamily,
  test: agencyFamily,
  publish: agencyFamily,
  workflows: agencyFamily,
  general: [...agencyFamily, ...groupReads],
  users: peopleFamily,
  groups: peopleFamily,
  agents: [
    "ai_",
    "agency_list_roles",
    "agency_get_role",
    "actor_list_groups",
    "comm_chat_thread_list",
  ],
  models: ["ai_"],
  approvals: [
    "agency_list_approvals",
    "agency_get_approval",
    "agency_list_roles",
  ],
  operations: operationsFamily,
  network: operationsFamily,
  activity: operationsFamily,
  alerts: operationsFamily,
  documents: [
    "sources_",
    "comm_chat_thread_list",
    "comm_chat_message_list",
    "actor_list_actors",
    "agency_list_roles",
  ],
  "farm-orders": ["forms_", "assetmanager_"],
  produce: ["forms_", "assetmanager_"],
  equipment: ["assetmanager_"],
};

const fallbackFamily = [
  "agency_get_agency",
  "agency_list_roles",
  "actor_list_groups",
  "ai_list_accounts",
  "ai_list_roles",
];

export const toolFamilyOf = (page: string): string[] =>
  chatPageOf(page)?.reads ?? families[page] ?? fallbackFamily;

export const writeToolsOf = (page: string): string[] =>
  chatPageOf(page)?.writes ?? [];

export const suggestToolsOf = (page: string): string[] =>
  chatPageOf(page)?.suggests ?? [];

export const draftArgument = "draft_id";

export const inFamily = (name: string, family: string[]): boolean =>
  family.some((entry) =>
    entry.endsWith("_") ? name.startsWith(entry) : name === entry,
  );

const shorter = (text: string, limit: number): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  const sentence = flat.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? flat;
  return sentence.length > limit
    ? `${sentence.slice(0, limit - 1)}…`
    : sentence;
};

export const firstSentence = (text: string): string =>
  shorter(text, maxDescription);

export const areaOf = (name: string): string => name.split("_")[0];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const slimProperty = (value: unknown): unknown =>
  isObject(value) && typeof value.description === "string"
    ? {
        ...value,
        description: shorter(value.description, maxPropertyDescription),
      }
    : value;

const slimProperties = (
  properties: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      slimProperty(value),
    ]),
  );

export const takesDraft = (tool: ToolInfo): boolean =>
  isObject(tool.inputSchema.properties) &&
  draftArgument in tool.inputSchema.properties;

export function specOf(
  tool: ToolInfo,
  hubArgument: string,
  hidden: string[] = [],
): ToolSpec {
  const dropped = new Set([hubArgument, ...hidden]);
  const properties = Object.fromEntries(
    Object.entries(
      isObject(tool.inputSchema.properties) ? tool.inputSchema.properties : {},
    ).filter(([key]) => !dropped.has(key)),
  );
  const required = Array.isArray(tool.inputSchema.required)
    ? tool.inputSchema.required.filter((key) => !dropped.has(String(key)))
    : [];
  return {
    name: tool.name,
    description: shorter(tool.description, maxDescription),
    parameters: {
      ...tool.inputSchema,
      type: "object",
      properties: slimProperties(properties),
      required,
    },
  };
}

export const showWorkflowFormTool = "show_workflow_form";

export const showScenarioFormTool = "show_scenario_form";

export const showProfileFormTool = "show_profile_form";

export const createGoalsTool = "create_goals";

const stepsProperty = {
  type: "array",
  description: "The steps, in order. Leave out when the manager gave none.",
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "What the step is called." },
      role: {
        type: "string",
        description:
          "The name of the role of the person who takes the step, as listed by agency_list_roles.",
      },
      kind: {
        type: "string",
        description:
          "fill_form, send_form, notify, yes_no, route or run_workflow.",
      },
    },
    required: ["name"],
  },
};

const actorsProperty = {
  type: "array",
  description:
    "The people the test plays besides the workflow's own roles, one entry each.",
  items: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "The actor's name, unique in the scenario, for example Farmer 2.",
      },
      role: {
        type: "string",
        description:
          "The name of the actor's role, as listed by agency_list_roles.",
      },
    },
    required: ["name", "role"],
  },
};

const workflowFormSpec: ToolSpec = {
  name: showWorkflowFormTool,
  description:
    "Fills the Add a workflow form in the content area next to this chat for the manager to check. Nothing is recorded until the manager presses Save. Call it when asked to add a workflow or a cancel workflow, after looking up the existing workflows and roles.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "The workflow's name." },
      description: {
        type: "string",
        description: "What the workflow is for, in one sentence.",
      },
      cancel: {
        type: "boolean",
        description: "True when the manager asked for a cancel workflow.",
      },
      steps: stepsProperty,
    },
    required: ["name"],
  },
};

const scenarioFormSpec: ToolSpec = {
  name: showScenarioFormTool,
  description:
    "Fills the Add a scenario form in the content area next to this chat for the manager to check. Nothing is recorded until the manager presses Save. Call it when asked to add a scenario, after looking up the existing workflows and roles.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "The scenario's name." },
      workflow: {
        type: "string",
        description:
          "The name of the workflow the scenario follows, as listed by agency_list_workflows.",
      },
      summary: {
        type: "string",
        description: "What the scenario tries, in one sentence.",
      },
      actors: actorsProperty,
    },
    required: ["name"],
  },
};

const profileFormSpec: ToolSpec = {
  name: showProfileFormTool,
  description:
    "Fills the Name and Purpose fields of the Profile page next to this chat for the manager to check. Nothing is recorded until the manager presses Save changes. Call it when asked to rename the agency or to change, shorten, widen or rewrite its Purpose, after reading the agency with agency_get_agency.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "The agency's new name. Leave out when the name stays.",
      },
      purpose: {
        type: "string",
        description:
          "The whole new Purpose text, not only the changed part. Leave out when the Purpose stays.",
      },
    },
    required: [],
  },
};

const formSpecs: Record<string, ToolSpec> = {
  workflows: workflowFormSpec,
  test: scenarioFormSpec,
  profile: profileFormSpec,
};

export const formToolOf = (page: string): ToolSpec | null =>
  formSpecs[page] ?? null;

const createGoalsSpec: ToolSpec = {
  name: createGoalsTool,
  description:
    "Creates goals, each with its objectives, in the agency's working draft right away, with no form and no question to the manager. Call it once with all the goals when asked to create, generate or add goals, after reading the agency with agency_get_agency and the existing goals with agency_list_goals so none is repeated.",
  parameters: {
    type: "object",
    properties: {
      goals: {
        type: "array",
        description:
          "The goals to create, three to six unless the manager asked for a number.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "The goal's name, short." },
            description: {
              type: "string",
              description:
                "What the goal means for the agency, in one or two sentences.",
            },
            objectives: {
              type: "array",
              description: "Two or three concrete objectives under the goal.",
              items: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "The objective's name, short.",
                  },
                  description: {
                    type: "string",
                    description:
                      "What reaching it looks like, in one sentence.",
                  },
                },
                required: ["title"],
              },
            },
          },
          required: ["title"],
        },
      },
    },
    required: ["goals"],
  },
};

const directSpecs: Record<string, ToolSpec> = { goals: createGoalsSpec };

export const directToolOf = (page: string): ToolSpec | null =>
  directSpecs[page] ?? null;

export const readObjectivesTool = "read_objectives";

const readObjectivesSpec: ToolSpec = {
  name: readObjectivesTool,
  description:
    "Returns every objective in one call: its id, code, title, description, its goal, the workflows that deliver it, and the roles in the responsible, accountable, consulted and informed seats on the steps of those workflows. Leave both arguments out for all of them, or name the ones you want. Use it to read or review the objectives instead of looking them up one at a time.",
  parameters: {
    type: "object",
    properties: {
      objectives: {
        type: "array",
        items: { type: "string" },
        description: "Only these objectives, by code such as O-15 or by id.",
      },
      roles: {
        type: "array",
        items: { type: "string" },
        description:
          "Only the objectives where one of these roles holds a seat on a step, by role name.",
      },
    },
    required: [],
  },
};

const readSpecs: Record<string, ToolSpec> = {
  objectives: readObjectivesSpec,
  goals: readObjectivesSpec,
};

export const readOverviewToolOf = (page: string): ToolSpec | null =>
  readSpecs[page] ?? null;

export const showSuggestionsTool = "show_suggestions";

const carriableOf = (
  page: string,
  all: ToolInfo[],
  hubArgument: string,
): string =>
  suggestToolsOf(page)
    .map((name) => all.find((tool) => tool.name === name))
    .filter((tool): tool is ToolInfo => tool !== undefined)
    .map((tool) => {
      const { parameters } = specOf(tool, hubArgument, [draftArgument]);
      return `${tool.name}(${Object.keys(isObject(parameters.properties) ? parameters.properties : {}).join(", ")})`;
    })
    .join("; ");

const suggestionsSpec = (
  page: string,
  all: ToolInfo[],
  hubArgument: string,
): ToolSpec => ({
  name: showSuggestionsTool,
  description: `Opens a Chat response tab beside the page in the content area, listing your suggestions with an Apply and a Dismiss button on each row. Nothing changes until the manager presses Apply. Call it when asked to review, check, audit or improve what is on the page, after reading it, instead of describing the suggestions in the reply. The tools a suggestion can carry: ${carriableOf(page, all, hubArgument)}.`,
  parameters: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "One sentence on what the review found.",
      },
      suggestions: {
        type: "array",
        description: "One entry per suggested change, most important first.",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description:
                "The suggestion in a few words, naming the item it concerns, for example Merge O-15 into O-22.",
            },
            detail: { type: "string", description: "Why, in one sentence." },
            tool: {
              type: "string",
              description:
                "The name of the tool that makes the change when the manager presses Apply. Leave out when the suggestion is advice no tool can carry out.",
            },
            arguments: {
              type: "object",
              description:
                "The arguments for that tool, using the ids you read. Leave out the instance and the draft.",
            },
            then: {
              type: "array",
              description:
                "Further changes made after the first, in order, when one change is not enough: a merge updates the item that is kept, then deletes the duplicate.",
              items: {
                type: "object",
                properties: {
                  tool: { type: "string" },
                  arguments: { type: "object" },
                },
                required: ["tool"],
              },
            },
          },
          required: ["title"],
        },
      },
    },
    required: ["suggestions"],
  },
});

export const suggestionsToolOf = (
  page: string,
  all: ToolInfo[] = [],
  hubArgument = "instance_id",
): ToolSpec | null =>
  chatPageOf(page)?.suggests ? suggestionsSpec(page, all, hubArgument) : null;
