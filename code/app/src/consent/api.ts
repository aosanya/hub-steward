import { callTool } from "../wakala/mcp";

export type ConsentText = { version: string; clauses: string[] };

const text = (value: unknown) => (typeof value === "string" ? value : "");

export const consentTextOf = (raw: any): ConsentText => ({
  version: text(raw?.version),
  clauses: (Array.isArray(raw?.clauses) ? raw.clauses : []).map((clause: any) => text(clause?.text).trim()).filter(Boolean),
});

export const readInForce = async (agencyId: string): Promise<ConsentText | null> => {
  const found = consentTextOf(await callTool(agencyId, "custody_get_in_force_consent"));
  return found.clauses.length > 0 ? found : null;
};

export const owesConsent = async (agencyId: string): Promise<boolean> => {
  const { status } = await callTool<{ status?: string }>(agencyId, "custody_get_my_consent");
  if (status !== "none" && status !== "withdrawn") return false;
  return (await readInForce(agencyId)) !== null;
};

export const agree = (agencyId: string) => callTool(agencyId, "custody_agree_consent");
