import type { ActionAnswer } from "./chatAnswer";
import type { ToolDrawing } from "./actionSchema";
import type { ToolSpec } from "./chatTools";
import { limitRaiseAction } from "./limitRaise";
import { roleLimitAction } from "./roleLimitAction";
import { usagePageIds } from "./chatPages/usage";
import { usageAnswerAction } from "./usageAnswer";

type Args = Record<string, unknown>;

export type ActionTool = { spec: ToolSpec; answer: (prompt: string, args: Args) => ActionAnswer };

export const pageActions: Record<string, ActionTool[]> = {
  models: [roleLimitAction, limitRaiseAction],
  ...Object.fromEntries(usagePageIds.map((id) => [id, [usageAnswerAction]])),
};

export const actionToolsOf = (page: string): ActionTool[] => (Object.hasOwn(pageActions, page) ? pageActions[page] : []);

export const formView = "form";

export const approvalView = "approval";

export const listView = "list";

export const maxListRows = 50;

export const maxListColumns = 8;

export type FormActionParams = ToolDrawing & { initial?: Args; fixed?: Args; notice?: string };

export type ApprovalActionParams = { tool: string; arguments: Args; text?: string; notice?: string };

const isObject = (value: unknown): value is Args => typeof value === "object" && value !== null && !Array.isArray(value);

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

const namesOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((name): name is string => typeof name === "string") : []);

const shapeOf = (value: unknown): Record<string, Args> | undefined =>
  isObject(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, Args] => isObject(entry[1]))) : undefined;

export function formParamsOf(params: Args): FormActionParams | null {
  const tool = textOf(params.tool);
  const show = namesOf(params.show);
  if (tool === "" || show.length === 0) return null;
  const shape = shapeOf(params.shape);
  return {
    tool,
    show,
    ...(shape ? { shape } : {}),
    ...(isObject(params.initial) ? { initial: params.initial } : {}),
    ...(isObject(params.fixed) ? { fixed: params.fixed } : {}),
    ...(textOf(params.notice) ? { notice: textOf(params.notice) } : {}),
  };
}

export function approvalParamsOf(params: Args): ApprovalActionParams | null {
  const tool = textOf(params.tool);
  if (tool === "") return null;
  return {
    tool,
    arguments: isObject(params.arguments) ? params.arguments : {},
    ...(textOf(params.text) ? { text: textOf(params.text) } : {}),
    ...(textOf(params.notice) ? { notice: textOf(params.notice) } : {}),
  };
}

export const formAction = (prompt: string, title: string, params: FormActionParams): ActionAnswer => ({
  kind: "action",
  prompt,
  view: formView,
  title,
  params,
});

export const approvalAction = (prompt: string, title: string, params: ApprovalActionParams): ActionAnswer => ({
  kind: "action",
  prompt,
  view: approvalView,
  title,
  params,
});

export type ListActionParams = { columns: string[]; rows: string[][] };

const cellOf = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : "");

export function listParamsOf(params: Args): ListActionParams | null {
  const columns = namesOf(params.columns).slice(0, maxListColumns);
  if (columns.length === 0) return null;
  const rows = (Array.isArray(params.rows) ? params.rows : [])
    .filter((row): row is unknown[] => Array.isArray(row))
    .slice(0, maxListRows)
    .map((row) => columns.map((_, index) => cellOf(row[index])));
  return { columns, rows };
}

export const listAction = (prompt: string, title: string, params: Args): ActionAnswer => ({
  kind: "action",
  prompt,
  view: listView,
  title,
  params: listParamsOf(params) ?? { columns: [], rows: [] },
});

const listSpec: ToolSpec = {
  name: "show_list",
  description:
    "Shows the manager, in the content area next to this chat, a table you fill from what you looked up. Call it when the answer is a list of several items that share the same fields; answer in a sentence when it is short.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "What the table lists, in a few words." },
      columns: { type: "array", items: { type: "string" }, description: "The column headings, at most eight." },
      rows: { type: "array", items: { type: "array", items: { type: "string" } }, description: "One array of cell texts per row, in the order of the columns." },
    },
    required: ["title", "columns", "rows"],
  },
};

export const listTool: ActionTool = {
  spec: listSpec,
  answer: (prompt, args) => listAction(prompt, typeof args.title === "string" ? args.title : "", args),
};
