import { callTool } from "../wakala/mcp";

export const triagerRoleName = "Triager";

export const publicationsTool = "agency_list_publications";

export const rolesTool = "agency_list_roles";

import { ruleCodesLine } from "./ruleCodes";

export const manyMatchesRule =
  "When a search finds seven or more issues and you need to know which one the owner means, never list the titles and never ask in words alone: name a few readings (a repo, a tag, a title word), each on its own line as [[option]], and ask for a narrower word if none fits.";

export const blockedIsATagRule =
  "Ready, Waiting, Sinbin and Blocked are marks, each a tag of its own: Ready means the Ready tag only, Waiting means the Waiting tag only (it waits on an issue that is not finished), Sinbin means the Sinbin tag only (a worker stopped at a cap and the owner reviews it) and Blocked means the Blocked tag only (a person must look); an issue never carries two of them. Filter by the tag the owner names and list Blocked, Sinbin and Waiting issues separately.";

export const backlogByNameRule =
  "When the owner asks to show a backlog or a smart backlog by name, call taskmanager_backlog_list first to find it, then read its issues: the page shows a card with an Open button for each backlog the owner named, so do not say where the card is and do not list the backlogs yourself.";

export const lookUpBeforeMoveRule =
  "To move an issue, first look it up with taskmanager_task_pending (q set to its key or title words) and move it by the id you read, never by its key; when no issue has that key, say you could not find it and move nothing.";

export const pageLines =
  `Answer the owner's questions by calling the tools you are given, and never name an issue you did not read from a tool. There are no chat posts or cards on this page: the issues you read are shown to the owner in a Results tab, so do not list them in your reply; answer briefly in the language the owner writes in, with how many there are and what stands out. You are given the read tools and three write tools: move an issue to a step, create a backlog (a smart one takes rules) and change a smart backlog's rules. A write is shown to the owner as a card and nothing changes until they tap its button, so do not ask them to confirm in words; if they cancel, say nothing was changed. When an ask needs a tool you were not given, say so in one sentence. ${manyMatchesRule} ${blockedIsATagRule} ${backlogByNameRule} ${lookUpBeforeMoveRule} ${ruleCodesLine}`;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value : "");

const itemsOf = (reply: unknown) => (isObject(reply) && Array.isArray(reply.items) ? reply.items.filter(isObject) : []);

const liveDraftOf = (reply: unknown) => {
  const production = itemsOf(reply).filter((item) => item.channel === "production");
  const newest = production.sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0))[0];
  return newest ? text(newest.draft_id) : "";
};

export async function triagerDescription(): Promise<string> {
  try {
    const draft = liveDraftOf(await callTool("", publicationsTool, {}));
    if (draft === "") return "";
    const roles = itemsOf(await callTool("", rolesTool, { draft_id: draft }));
    const found = roles.find((role) => text(role.name).toLowerCase() === triagerRoleName.toLowerCase());
    return found ? text(found.description).trim() : "";
  } catch {
    return "";
  }
}

export const promptFrom = (description: string, fallback: string) => (description === "" ? fallback : `${description}\n\n${pageLines}`);
