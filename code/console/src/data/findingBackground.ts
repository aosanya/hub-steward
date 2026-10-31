import type { Suggestion } from "./chatAnswer";
import { draftBackground } from "./enhanceBackground";
import type { Finding } from "./reviewApi";

const pageOfArea: Record<string, string> = {
  profile: "profile",
  goals: "goals",
  objectives: "objectives",
  roles_agents: "roles",
  workflows: "workflows",
  risks: "bowties",
};

const proposalOf = (item: Suggestion): string =>
  item.tool === ""
    ? "none yet"
    : JSON.stringify({ tool: item.tool, arguments: item.arguments, then: item.then });

export const findingText = (item: Suggestion, part: string, notes: string[]): string =>
  [
    "The manager is asking about this finding of the review of the agency draft:",
    `Part: ${part}`,
    `Title: ${item.title}`,
    `Detail: ${item.detail}`,
    `Proposed change: ${proposalOf(item)}`,
    ...(notes.length > 0 ? [`Notes the manager wrote on it: ${notes.join(" | ")}`] : []),
    "Answer from the real goals, objectives, roles and workflows below. Where a change to the draft would settle it, name the exact change with real values from the draft, and say what you would set, instead of answering in general terms.",
  ].join("\n");

export async function findingBackground(hubId: string, item: Suggestion, part: string, notes: string[] = []): Promise<string> {
  const around = await draftBackground(hubId, pageOfArea[part] ?? part).catch(() => "");
  const own = findingText(item, part, notes);
  return around === "" ? own : `${own}\n\n${around}`;
}

export const suggestionOf = (finding: Finding): Suggestion => ({
  title: finding.title,
  detail: finding.detail,
  tool: finding.tool,
  arguments: finding.arguments,
  then: finding.then,
});
