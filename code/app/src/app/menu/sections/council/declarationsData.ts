import { mcpStepsClient } from "../../../../features/steps/api";
import { stepsPaths } from "../../../../features/steps/routePaths";
import { callTool } from "../../../../shared/wakala/mcp";
import { text, type Item } from "./councilData";

export const declarationsTool = "agency_list_declarations";

export type Declaration = { id: string; title: string; meta: string; name: string; declaredOn: string; answers: { prompt: string; answer: string }[] };

export type Declarations = { declared: Declaration[]; notDeclared: string[]; notDeclaredCount: number; declareTo: string };

const listOfItems = (value: unknown): Item[] => (Array.isArray(value) ? value.filter((entry): entry is Item => !!entry && typeof entry === "object") : []);

const declarationOf = (raw: Item): Declaration => ({
  id: text(raw, "row_id"),
  title: text(raw, "name"),
  meta: text(raw, "declared_on"),
  name: text(raw, "name"),
  declaredOn: text(raw, "declared_on"),
  answers: Object.entries((raw.answers && typeof raw.answers === "object" ? raw.answers : {}) as Record<string, unknown>).map(([prompt, answer]) => ({ prompt, answer: typeof answer === "string" ? answer : answer == null ? "" : String(answer) })),
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
    notDeclared: readsAll && count > 0 ? listOfItems(reply.not_declared).map((member) => text(member, "name")) : [],
    notDeclaredCount: readsAll ? count : 0,
    declareTo: declared.length === 0 ? await declareStepPath() : "",
  };
};

export const declarationEmpty = (declarations: Declarations | null, home: { words: string; act: string; to: string }) =>
  declarations?.declareTo ? { words: "You have not declared.", act: "Declare", to: declarations.declareTo } : home;
