import { mcpStepsClient } from "../../../../features/steps/api";
import { stepsPaths } from "../../../../features/steps/routePaths";
import { dayWords } from "../../../../shared/ui/days";
import { callTool } from "../../../../shared/wakala/mcp";
import { shownName } from "../settings/personLabel";
import { text, type Item } from "./councilData";

export const declarationsTool = "agency_list_declarations";

export type Declaration = { id: string; title: string; meta: string; name: string; declaredOn: string; answers: { prompt: string; answer: string }[] };

export type Declarations = { declared: Declaration[]; notDeclared: string[]; notDeclaredCount: number; declareTo: string };

const listOfItems = (value: unknown): Item[] => (Array.isArray(value) ? value.filter((entry): entry is Item => !!entry && typeof entry === "object") : []);

const shown = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

const answersOf = (raw: Item): Declaration["answers"] => {
  if (Array.isArray(raw.fields)) {
    return listOfItems(raw.fields).map((field) => ({ prompt: text(field, "prompt") || text(field, "key"), answer: shown(field.value) }));
  }
  const keyed = (raw.answers && typeof raw.answers === "object" ? raw.answers : {}) as Record<string, unknown>;
  return Object.entries(keyed).map(([prompt, answer]) => ({ prompt, answer: shown(answer) }));
};

const declarationOf = (raw: Item): Declaration => ({
  id: text(raw, "row_id"),
  title: shownName(text(raw, "name")),
  meta: dayWords(text(raw, "declared_on")),
  name: shownName(text(raw, "name")),
  declaredOn: dayWords(text(raw, "declared_on")),
  answers: answersOf(raw),
});

const isDeclarationStep = (step: { title: string; formName: string; workflowName: string }) => /declar/i.test(`${step.title} ${step.formName} ${step.workflowName}`);

const declareStepPath = async () => {
  try {
    const step = (await mcpStepsClient.available()).find(isDeclarationStep);
    return step ? stepsPaths.step.path({ stepId: step.id }) : "";
  } catch {
    return "";
  }
};

export const readDeclarations = async (): Promise<Declarations> => {
  const reply = ((await callTool("", declarationsTool)) ?? {}) as Item;
  const declared = listOfItems(reply.declared).map(declarationOf);
  const readsAll = reply.can_read_all === true;
  const count = typeof reply.not_declared_count === "number" ? reply.not_declared_count : 0;
  return {
    declared,
    notDeclared: readsAll && count > 0 ? listOfItems(reply.not_declared).map((member) => shownName(text(member, "name"))) : [],
    notDeclaredCount: readsAll ? count : 0,
    declareTo: declared.length === 0 ? await declareStepPath() : "",
  };
};

export const declarationEmpty = (declarations: Declarations | null, home: { words: string; act: string; to: string }) =>
  declarations?.declareTo ? { words: "You have not declared.", act: "Declare", to: declarations.declareTo } : home;
