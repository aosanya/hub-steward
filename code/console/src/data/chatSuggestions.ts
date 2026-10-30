import { callTool, listTools } from "../wakala/mcp";
import type { Suggestion, SuggestionStep } from "./chatAnswer";
import { draftArgument, suggestToolsOf, takesDraft } from "./chatTools";
import { workingDraft } from "./pages/workflowDesign";

const hubArgument = "instance_id";

async function applyStep(hubId: string, page: string, step: SuggestionStep): Promise<void> {
  if (!step.tool || !suggestToolsOf(page).includes(step.tool)) throw new Error("this suggestion has no change to apply");
  const tool = (await listTools()).find((entry) => entry.name === step.tool);
  if (!tool) throw new Error(`the tool ${step.tool} is not available`);
  const draft = takesDraft(tool) ? { [draftArgument]: await workingDraft(hubId) } : {};
  await callTool(hubId, step.tool, { ...step.arguments, ...draft, [hubArgument]: hubId });
}

export async function applySuggestion(hubId: string, page: string, suggestion: Suggestion): Promise<void> {
  const steps = [{ tool: suggestion.tool, arguments: suggestion.arguments }, ...(suggestion.then ?? [])];
  for (const step of steps) await applyStep(hubId, page, step);
}
