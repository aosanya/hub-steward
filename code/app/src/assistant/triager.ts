import { callTool } from "../wakala/mcp";

export const triagerRoleName = "Triager";

export const publicationsTool = "agency_list_publications";

export const rolesTool = "agency_list_roles";

export const pageLines =
  "Answer the owner's questions by calling the tools you are given, and never name an issue you did not read from a tool. There are no chat posts or cards on this page: the issues you read are shown to the owner in a Results tab, so do not list them in your reply; answer briefly in the language the owner writes in, with how many there are and what stands out. You are given the read tools and three write tools: move an issue to a step, create a backlog (a smart one takes rules) and change a smart backlog's rules. A write is shown to the owner as a card and nothing changes until they tap its button, so do not ask them to confirm in words; if they cancel, say nothing was changed. When an ask needs a tool you were not given, say so in one sentence.";

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
