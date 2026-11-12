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

export type MyConsent = "none" | "agreed" | "withdrawn";

export const readMine = async (agencyId: string): Promise<MyConsent> => {
  const { status } = await callTool<{ status?: string }>(agencyId, "custody_get_my_consent");
  return status === "agreed" || status === "withdrawn" ? status : "none";
};

export const owesConsent = async (agencyId: string): Promise<boolean> => {
  if ((await readMine(agencyId)) === "agreed") return false;
  return (await readInForce(agencyId)) !== null;
};

export const versionNumber = (version: string) => version.replace(/^v/i, "");

export const agree = (agencyId: string) => callTool(agencyId, "custody_agree_consent");

export const withdraw = (agencyId: string) => callTool(agencyId, "custody_withdraw_consent");
