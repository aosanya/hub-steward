import { callTool } from "../../wakala/mcp";
import { workingDraft } from "../../data/pages/workflowDesign";

export type RiskValues = { title: string; topEvent: string };

export type RiskEditValues = RiskValues & { hazard: string; hazardCode: string; owner: string };

export type PartValues = { title: string; description: string; hazardCode?: string };

export type PartSide = "threat" | "consequence";

export const createRisk = async (hubId: string, values: RiskValues) => {
  const draftId = await workingDraft(hubId);
  await callTool(hubId, "agency_create_risk", {
    draft_id: draftId,
    title: values.title.trim(),
    top_event: values.topEvent.trim(),
  });
};

export const updateRisk = async (hubId: string, riskId: string, values: RiskEditValues) => {
  const draftId = await workingDraft(hubId);
  await callTool(hubId, "agency_update_risk", {
    draft_id: draftId,
    risk_id: riskId,
    title: values.title.trim(),
    top_event: values.topEvent.trim(),
    hazard: values.hazard.trim(),
    ...(values.hazardCode ? { hazard_code: values.hazardCode } : {}),
    owner: values.owner.trim(),
  });
};

export const deleteRisk = async (hubId: string, riskId: string) => {
  await callTool(hubId, "agency_delete_risk", { risk_id: riskId });
};

const tools = {
  threat: { create: "agency_create_threat", link: "agency_create_risk_threat", unlink: "agency_delete_risk_threat", unlinkArg: "risk_threat_id", codeArg: "threat_code" },
  consequence: {
    create: "agency_create_consequence",
    link: "agency_create_risk_consequence",
    unlink: "agency_delete_risk_consequence",
    unlinkArg: "risk_consequence_id",
    codeArg: "consequence_code",
  },
} as const;

export const linkPart = async (hubId: string, riskCode: string, side: PartSide, partCode: string) => {
  const draftId = await workingDraft(hubId);
  await callTool(hubId, tools[side].link, { draft_id: draftId, risk_code: riskCode, [tools[side].codeArg]: partCode });
};

export const createPart = async (hubId: string, side: PartSide, values: PartValues): Promise<string> => {
  const draftId = await workingDraft(hubId);
  const made = await callTool<{ code?: string }>(hubId, tools[side].create, {
    draft_id: draftId,
    title: values.title.trim(),
    description: values.description.trim(),
    ...(side === "consequence" ? { hazard_code: values.hazardCode ?? "" } : {}),
  });
  return typeof made?.code === "string" ? made.code : "";
};

export const unlinkPart = async (hubId: string, side: PartSide, linkId: string) => {
  await callTool(hubId, tools[side].unlink, { [tools[side].unlinkArg]: linkId });
};

export const deletePathway = async (hubId: string, pathwayId: string) => {
  await callTool(hubId, "agency_delete_risk_pathway", { risk_pathway_id: pathwayId });
};
