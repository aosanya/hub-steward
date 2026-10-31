import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import { draftScope } from "../draft";
import type { PageModule, Query } from "../types";

type Item = Record<string, unknown>;

export type LibraryKind = "hazard" | "threat" | "consequence";

export type LibraryPart = { id: string; code: string; title: string; description: string; hazardCode?: string };

export type LibraryHazardRow = LibraryPart & { usedIn: number; controls: string };

export type Bowtie = { id: string; code: string; title: string };

export type LibraryPartRow = LibraryPart & { usedIn: number; unguarded: boolean; controls: string; hazardTitle?: string; hazardId?: string; bowties: Bowtie[] };

export type LibraryControlRow = { id: string; code: string; title: string; usedIn: number; controls: string };

export type PartInput = { title: string; description?: string; hazardCode?: string };

const isRecord = (value: unknown): value is Item => typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value : "");

const itemsOf = (answer: unknown): Item[] => {
  const list = Array.isArray(answer) ? answer : isRecord(answer) && Array.isArray(answer.items) ? answer.items : [];
  return list.filter(isRecord);
};

export const noControlsWord = "No controls";

export const controlsWord = (count: number) => `Controls: ${count}`;

export const usedInWord = (count: number) => `Used in ${count} ${count === 1 ? "bowtie" : "bowties"}`;

const partOf = (item: Item): LibraryPart => ({
  id: text(item.id),
  code: text(item.code),
  title: text(item.title),
  description: text(item.description),
  ...(item.hazard_code === undefined ? {} : { hazardCode: text(item.hazard_code) }),
});

const listKind = async (hubId: string, kind: LibraryKind, query: Query): Promise<LibraryPart[]> => {
  const plural = kind === "consequence" ? "consequences" : `${kind}s`;
  return itemsOf(await callTool<unknown>(hubId, `agency_list_${plural}`, await draftScope(hubId, query))).map(partOf);
};

export const listHazards = (hubId: string, query: Query = {}) => listKind(hubId, "hazard", query);

export const listThreats = (hubId: string, query: Query = {}) => listKind(hubId, "threat", query);

export const listConsequences = (hubId: string, query: Query = {}) => listKind(hubId, "consequence", query);

const distinct = (values: string[]) => new Set(values.filter((value) => value !== "")).size;

const usageByCode = (links: Item[], partKey: string): Map<string, Set<string>> => {
  const usage = new Map<string, Set<string>>();
  for (const link of links) {
    const code = text(link[partKey]);
    const risks = usage.get(code) ?? new Set<string>();
    risks.add(text(link.risk_code));
    usage.set(code, risks);
  }
  return usage;
};

export const threatUsage = async (hubId: string, query: Query = {}) =>
  usageByCode(itemsOf(await callTool<unknown>(hubId, "agency_list_risk_threats", await draftScope(hubId, query))), "threat_code");

export const consequenceUsage = async (hubId: string, query: Query = {}) =>
  usageByCode(itemsOf(await callTool<unknown>(hubId, "agency_list_risk_consequences", await draftScope(hubId, query))), "consequence_code");

export const unguardedCodes = async (hubId: string, query: Query = {}): Promise<Set<string>> =>
  new Set(itemsOf(await callTool<unknown>(hubId, "agency_list_unguarded_parts", await draftScope(hubId, query))).map((part) => text(part.code)));

export const hazardRows = async (hubId: string, query: Query = {}): Promise<LibraryHazardRow[]> => {
  const [hazards, risks] = await Promise.all([
    listHazards(hubId, query),
    draftScope(hubId, query).then((scope) => callTool<unknown>(hubId, "agency_list_risks", scope)),
  ]);
  const named = itemsOf(risks);
  return hazards.map((hazard) => ({
    ...hazard,
    usedIn: distinct(named.filter((risk) => text(risk.hazard_code) === hazard.code).map((risk) => text(risk.code))),
    controls: "",
  }));
};

const bowtieTitles = async (hubId: string, query: Query): Promise<Map<string, { id: string; title: string }>> =>
  new Map(
    itemsOf(await callTool<unknown>(hubId, "agency_list_risks", await draftScope(hubId, query))).map((risk) => [text(risk.code), { id: text(risk.id), title: text(risk.title) }]),
  );

const partRows = (parts: LibraryPart[], usage: Map<string, Set<string>>, unguarded: Set<string>, titles: Map<string, { id: string; title: string }>): LibraryPartRow[] =>
  parts.map((part) => ({
    ...part,
    usedIn: usage.get(part.code)?.size ?? 0,
    bowties: [...(usage.get(part.code) ?? [])].filter((code) => code !== "").map((code) => ({ code, id: titles.get(code)?.id ?? "", title: titles.get(code)?.title || code })),
    unguarded: unguarded.has(part.code),
    controls: unguarded.has(part.code) ? noControlsWord : "",
  }));

export const threatRows = async (hubId: string, query: Query = {}): Promise<LibraryPartRow[]> => {
  const [parts, usage, unguarded, titles] = await Promise.all([
    listThreats(hubId, query),
    threatUsage(hubId, query),
    unguardedCodes(hubId, query),
    bowtieTitles(hubId, query),
  ]);
  return partRows(parts, usage, unguarded, titles);
};

export const consequenceRows = async (hubId: string, query: Query = {}): Promise<LibraryPartRow[]> => {
  const [parts, usage, unguarded, hazards, bowties] = await Promise.all([
    listConsequences(hubId, query),
    consequenceUsage(hubId, query),
    unguardedCodes(hubId, query),
    listHazards(hubId, query),
    bowtieTitles(hubId, query),
  ]);
  const found = new Map(hazards.map((hazard) => [hazard.code, hazard]));
  return partRows(parts, usage, unguarded, bowties).map((row) => ({ ...row, hazardTitle: found.get(row.hazardCode ?? "")?.title ?? "", hazardId: found.get(row.hazardCode ?? "")?.id ?? "" }));
};

const guardedTargets = (attachments: Item[]) =>
  attachments.filter((attachment) => ["threat", "consequence"].includes(text(attachment.target_type))).map((attachment) => text(attachment.target_code));

export const listLibraryControls = async (hubId: string, query: Query = {}): Promise<LibraryControlRow[]> => {
  const controls = itemsOf(await callTool<unknown>(hubId, "agency_list_controls", await draftScope(hubId, query)));
  return Promise.all(
    controls.map(async (control) => {
      const targets = guardedTargets(itemsOf(await callTool<unknown>(hubId, "agency_list_control_attachments", { control_id: text(control.id) })));
      return { id: text(control.id), code: text(control.code), title: text(control.text), usedIn: targets.length, controls: targets.join(", ") };
    }),
  );
};

const writeBody = async (hubId: string, input: PartInput, query: Query) => ({
  ...(await draftScope(hubId, query)),
  title: input.title,
  ...(input.description === undefined ? {} : { description: input.description }),
  ...(input.hazardCode === undefined ? {} : { hazard_code: input.hazardCode }),
});

const createPart = (kind: LibraryKind) => async (hubId: string, input: PartInput, query: Query = {}) =>
  callTool<unknown>(hubId, `agency_create_${kind}`, await writeBody(hubId, input, query));

const updatePart = (kind: LibraryKind) => async (hubId: string, id: string, input: PartInput, query: Query = {}) =>
  callTool<unknown>(hubId, `agency_update_${kind}`, { ...(await writeBody(hubId, input, query)), [`${kind}_id`]: id });

const deletePart = (kind: LibraryKind) => (hubId: string, id: string) => callTool<unknown>(hubId, `agency_delete_${kind}`, { [`${kind}_id`]: id });

export const createHazard = createPart("hazard");
export const updateHazard = updatePart("hazard");
export const deleteHazard = deletePart("hazard");
export const createThreat = createPart("threat");
export const updateThreat = updatePart("threat");
export const deleteThreat = deletePart("threat");
export const createConsequence = createPart("consequence");
export const updateConsequence = updatePart("consequence");
export const deleteConsequence = deletePart("consequence");

export const linkThreat = async (hubId: string, riskCode: string, threatCode: string, query: Query = {}) =>
  callTool<unknown>(hubId, "agency_create_risk_threat", { ...(await draftScope(hubId, query)), risk_code: riskCode, threat_code: threatCode });

export const unlinkThreat = (hubId: string, riskThreatId: string) => callTool<unknown>(hubId, "agency_delete_risk_threat", { risk_threat_id: riskThreatId });

export const linkConsequence = async (hubId: string, riskCode: string, consequenceCode: string, query: Query = {}) =>
  callTool<unknown>(hubId, "agency_create_risk_consequence", { ...(await draftScope(hubId, query)), risk_code: riskCode, consequence_code: consequenceCode });

export const unlinkConsequence = (hubId: string, riskConsequenceId: string) =>
  callTool<unknown>(hubId, "agency_delete_risk_consequence", { risk_consequence_id: riskConsequenceId });

const rowOf = (row: LibraryHazardRow | LibraryPartRow): PageRow => ({
  id: row.id,
  code: row.code,
  title: row.title,
  used_in: usedInWord(row.usedIn),
  controls: row.controls,
});

const baseColumns = [
  { key: "code", label: "Code" },
  { key: "title", label: "Title" },
  { key: "used_in", label: "Used in" },
];

const partColumns = [...baseColumns, { key: "controls", label: "Controls" }];

export const hazardsPage: PageModule = {
  spec: {
    id: "hazards",
    title: "Hazards",
    primary: "Add a hazard",
    tools: ["agency_list_hazards", "agency_list_risks", "agency_create_hazard", "agency_update_hazard", "agency_delete_hazard"],
    columns: baseColumns,
  },
  rows: async (hubId, query) => (await hazardRows(hubId, query)).map(rowOf),
};

export const threatsPage: PageModule = {
  spec: {
    id: "threats",
    title: "Threats",
    primary: "Add a threat",
    tools: [
      "agency_list_threats",
      "agency_list_risk_threats",
      "agency_list_unguarded_parts",
      "agency_create_threat",
      "agency_update_threat",
      "agency_delete_threat",
      "agency_create_risk_threat",
      "agency_delete_risk_threat",
    ],
    columns: partColumns,
  },
  rows: async (hubId, query) => (await threatRows(hubId, query)).map(rowOf),
};

export const consequencesPage: PageModule = {
  spec: {
    id: "consequences",
    title: "Consequences",
    primary: "Add a consequence",
    tools: [
      "agency_list_consequences",
      "agency_list_hazards",
      "agency_list_risk_consequences",
      "agency_list_unguarded_parts",
      "agency_create_consequence",
      "agency_update_consequence",
      "agency_delete_consequence",
      "agency_create_risk_consequence",
      "agency_delete_risk_consequence",
    ],
    columns: partColumns,
  },
  rows: async (hubId, query) => (await consequenceRows(hubId, query)).map(rowOf),
};
