import { callTool } from "../wakala/mcp";
import { itemsOf, text, type Loose } from "./modelLimits";

export const listConsentVersionsTool = "custody_list_consent_versions";

export const getInForceConsentTool = "custody_get_in_force_consent";

export const publishConsentVersionTool = "custody_publish_consent_version";

export type ConsentVersion = { id: string; number: string; publishedAt: string; inForce: boolean };

const numberOf = (label: string) => label.replace(/^v/i, "");

const versionOf = (raw: Loose): ConsentVersion => ({
  id: text(raw.id),
  number: numberOf(text(raw.version)),
  publishedAt: text(raw.published_at),
  inForce: raw.in_force === true,
});

const clauseTexts = (raw: Loose): string[] =>
  (Array.isArray(raw.clauses) ? raw.clauses : []).map((clause) => text((clause as Loose | null)?.text)).filter((clause) => clause !== "");

export async function loadConsentVersions(hubId: string): Promise<ConsentVersion[]> {
  return itemsOf(await callTool<unknown>(hubId, listConsentVersionsTool)).map(versionOf);
}

export async function loadInForceText(hubId: string): Promise<string> {
  const held = await callTool<Loose>(hubId, getInForceConsentTool).catch(() => ({}) as Loose);
  return clauseTexts(held).join("\n\n");
}

export async function publishConsentVersion(hubId: string, consentText: string): Promise<string> {
  const published = await callTool<Loose>(hubId, publishConsentVersionTool, { text: consentText.trim() });
  return numberOf(text(published.version));
}

const dateLocale = (language: string) => (language === "en" ? "en-GB" : language);

export function publishedDay(iso: string, language: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";
  return when.toLocaleDateString(dateLocale(language), { day: "numeric", month: "short", year: "numeric" });
}
