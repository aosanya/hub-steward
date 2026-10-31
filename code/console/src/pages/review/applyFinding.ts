import { callTool, listTools } from "../../wakala/mcp";
import type { SuggestionStep } from "../../data/chatAnswer";
import { draftArgument, takesDraft } from "../../data/chatTools";
import { workingDraft } from "../../data/pages/workflowDesign";
import { setFindingStatus, type Finding } from "../../data/reviewApi";

const hubArgument = "instance_id";

const noChange = "this suggestion has no change to apply";

const reviewTools = [
  "agency_start_review",
  "agency_run_review",
  "agency_set_finding_status",
  "agency_comment_finding",
  "agency_record_review_area",
  "agency_review_input",
  "agency_run_scenario",
  "agency_run_scenarios",
];

const wholeDeletion = /^agency_delete_(workflow|goal|role)s?$/;

export const isFindingTool = (name: string): boolean =>
  name.startsWith("agency_") && !reviewTools.includes(name) && !wholeDeletion.test(name);

const stepsOf = (finding: Finding): SuggestionStep[] => [
  { tool: finding.tool, arguments: finding.arguments },
  ...(finding.then ?? []),
];

const checked = (steps: SuggestionStep[]): void => {
  if (steps.some((step) => !step.tool || !isFindingTool(step.tool))) throw new Error(noChange);
};

async function runStep(hubId: string, step: SuggestionStep): Promise<void> {
  const tool = (await listTools()).find((entry) => entry.name === step.tool);
  if (!tool) throw new Error(`the tool ${step.tool} is not available`);
  const draft = takesDraft(tool) ? { [draftArgument]: await workingDraft(hubId) } : {};
  await callTool(hubId, step.tool, { ...step.arguments, ...draft, [hubArgument]: hubId });
}

export async function applyFinding(hubId: string, finding: Finding): Promise<Finding> {
  const steps = stepsOf(finding);
  checked(steps);
  for (const step of steps) await runStep(hubId, step);
  return setFindingStatus(hubId, finding.id, "applied");
}

export function questionAboutFinding(finding: Finding, text: string): string {
  return `About your suggestion "${finding.title}"${finding.detail ? ` (${finding.detail})` : ""}: ${text}`;
}
