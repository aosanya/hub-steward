import { callTool } from "../../shared/wakala/mcp";

export type HomeCondition = { question: string; operator: string; value: string | { row: string } };

export type HomeTarget = { type: string; ref: string; name: string; step: string; scope: string; where: HomeCondition[]; workflowId: string; stepId: string };

export type HomeNode = {
  key: string;
  title: string;
  titles: Record<string, string>;
  icon: string;
  permission: string;
  roles: string[];
  pageOf: string;
  target: HomeTarget | null;
  entries: HomeNode[];
};

export const homeTool = "agency_get_home";

const text = (value: unknown) => (typeof value === "string" ? value : "");

const titlesOf = (raw: unknown): Record<string, string> => {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter((pair): pair is [string, string] => typeof pair[1] === "string" && pair[1].trim() !== ""));
};

const conditionOf = (raw: any): HomeCondition => {
  const value = raw?.value;
  const row = value !== null && typeof value === "object" ? text(value.row) : "";
  return { question: text(raw?.question), operator: text(raw?.operator), value: typeof value === "object" && value !== null ? { row } : text(value) };
};

const targetOf = (raw: any): HomeTarget | null => {
  const target = raw?.target;
  if (target === null || typeof target !== "object" || text(target.type) === "") return null;
  return {
    type: text(target.type),
    ref: text(target.ref),
    name: text(raw.target_name),
    step: text(target.step),
    scope: text(target.scope),
    where: (Array.isArray(target.where) ? target.where : []).map(conditionOf),
    workflowId: text(raw.workflow_id),
    stepId: text(raw.step_id),
  };
};

export const nodeOf = (raw: any): HomeNode => ({
  key: text(raw?.key),
  title: text(raw?.title),
  titles: titlesOf(raw?.titles),
  icon: text(raw?.icon),
  permission: text(raw?.permission),
  roles: (Array.isArray(raw?.roles) ? raw.roles : []).filter((role: unknown) => typeof role === "string"),
  pageOf: text(raw?.page_of),
  target: targetOf(raw),
  entries: (Array.isArray(raw?.entries) ? raw.entries : []).map(nodeOf),
});

export const readHome = async (): Promise<HomeNode[]> => {
  const reply = await callTool("", homeTool, {});
  if (!Array.isArray(reply?.entries)) throw new Error("agency_get_home answered without entries");
  return reply.entries.map(nodeOf).filter((node: HomeNode) => node.key !== "");
};

export const isSection = (node: HomeNode) => node.target === null;

export const titleIn = (node: HomeNode, code: string) => (node.titles[code] ?? "").trim() || node.title;

export const everyNode = (nodes: HomeNode[]): HomeNode[] => nodes.flatMap((node) => [node, ...everyNode(node.entries)]);

export const pathTo = (nodes: HomeNode[], key: string): HomeNode[] => {
  for (const node of nodes) {
    if (node.key === key) return [node];
    const below = pathTo(node.entries, key);
    if (below.length > 0) return [node, ...below];
  }
  return [];
};

export const findNode = (nodes: HomeNode[], key: string) => pathTo(nodes, key).at(-1);

export const pageOfRecord = (nodes: HomeNode[], code: string) => everyNode(nodes).find((node) => node.pageOf === code);
