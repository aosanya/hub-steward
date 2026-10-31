import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import { draftScope } from "../draft";
import type { PageModule, Query } from "../types";

type Item = Record<string, unknown>;

const isRecord = (value: unknown): value is Item => typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value : "");

const itemsOf = (answer: unknown): Item[] => {
  const list = Array.isArray(answer) ? answer : isRecord(answer) && Array.isArray(answer.items) ? answer.items : [];
  return list.filter(isRecord);
};

export type RiskSummary = { id: string; code: string; title: string; topEvent: string; hazard: string; hazardCode: string; owner: string };

export type PartSide = "threat" | "consequence";

export type Part = { id: string; linkId: string; code: string; title: string; description: string; controls: number; legacy: boolean };

export type RiskLanding = {
  risk: RiskSummary;
  hazardTitle: string;
  threats: Part[];
  consequences: Part[];
  library: { threats: Part[]; consequences: Part[] };
};

const riskOf = (item: Item): RiskSummary => ({
  id: text(item.id),
  code: text(item.code),
  title: text(item.title),
  topEvent: text(item.top_event),
  hazard: text(item.hazard),
  hazardCode: text(item.hazard_code),
  owner: text(item.owner),
});

const partOf = (item: Item): Part => ({
  id: text(item.id),
  linkId: "",
  code: text(item.code),
  title: text(item.title),
  description: text(item.description),
  controls: Array.isArray(item.control_codes) ? item.control_codes.length : 0,
  legacy: false,
});

const pathwayOf = (item: Item): Part => ({
  id: text(item.id),
  linkId: text(item.id),
  code: text(item.code),
  title: text(item.title),
  description: text(item.scenario),
  controls: 0,
  legacy: true,
});

export const listRisks = async (hubId: string, query: Query = {}): Promise<RiskSummary[]> =>
  itemsOf(await callTool<unknown>(hubId, "agency_list_risks", await draftScope(hubId, query))).map(riskOf);

export const pickRisk = (risks: RiskSummary[], wanted: string) => risks.find((risk) => risk.id === wanted) ?? risks[0];

const libraryOf = async (hubId: string, side: PartSide, scope: Record<string, unknown>) =>
  itemsOf(await callTool<unknown>(hubId, side === "threat" ? "agency_list_threats" : "agency_list_consequences", scope)).map(partOf);

const linksOf = async (hubId: string, side: PartSide, scope: Record<string, unknown>, risk: RiskSummary) =>
  itemsOf(
    await callTool<unknown>(hubId, side === "threat" ? "agency_list_risk_threats" : "agency_list_risk_consequences", { ...scope, risk_code: risk.code }),
  );

const linkedParts = (links: Item[], side: PartSide, library: Part[]): Part[] =>
  links.flatMap((link) => {
    const part = library.find((candidate) => candidate.code === text(link[side === "threat" ? "threat_code" : "consequence_code"]));
    return part ? [{ ...part, linkId: text(link.id) }] : [];
  });

const pathwaysOf = async (hubId: string, risk: RiskSummary, side: PartSide, scope: Record<string, unknown>) =>
  itemsOf(await callTool<unknown>(hubId, "agency_list_risk_pathways", { ...scope, risk_id: risk.id, side })).map(pathwayOf);

const hazardTitleOf = async (hubId: string, risk: RiskSummary, scope: Record<string, unknown>) => {
  if (risk.hazardCode === "") return risk.hazard;
  const hazards = itemsOf(await callTool<unknown>(hubId, "agency_list_hazards", { ...scope, code: risk.hazardCode }));
  const found = hazards.find((hazard) => text(hazard.code) === risk.hazardCode);
  return found ? text(found.title) : risk.hazard;
};

export const riskLanding = async (hubId: string, risk: RiskSummary, query: Query = {}): Promise<RiskLanding> => {
  const scope = await draftScope(hubId, query);
  const [threatLibrary, consequenceLibrary, threatLinks, consequenceLinks, hazardTitle] = await Promise.all([
    libraryOf(hubId, "threat", scope),
    libraryOf(hubId, "consequence", scope),
    linksOf(hubId, "threat", scope, risk),
    linksOf(hubId, "consequence", scope, risk),
    hazardTitleOf(hubId, risk, scope),
  ]);
  const library = { threats: threatLibrary, consequences: consequenceLibrary };
  if (threatLibrary.length === 0 && consequenceLibrary.length === 0) {
    const [threats, consequences] = await Promise.all([pathwaysOf(hubId, risk, "threat", scope), pathwaysOf(hubId, risk, "consequence", scope)]);
    return { risk, hazardTitle, threats, consequences, library };
  }
  return {
    risk,
    hazardTitle,
    threats: linkedParts(threatLinks, "threat", threatLibrary),
    consequences: linkedParts(consequenceLinks, "consequence", consequenceLibrary),
    library,
  };
};

const rows = async (hubId: string, query: Query): Promise<PageRow[]> =>
  (await listRisks(hubId, query)).map((risk) => ({ id: risk.id, code: risk.code, title: risk.title, top_event: risk.topEvent }));

export const risksPage: PageModule = {
  spec: {
    id: "risks",
    title: "Risks",
    primary: "",
    tools: ["agency_list_risks", "agency_list_risk_threats", "agency_list_risk_consequences", "agency_list_threats", "agency_list_consequences", "agency_list_hazards", "agency_list_risk_pathways"],
    columns: [
      { key: "code", label: "Code" },
      { key: "title", label: "Risk" },
      { key: "top_event", label: "Top event" },
    ],
  },
  rows,
};
