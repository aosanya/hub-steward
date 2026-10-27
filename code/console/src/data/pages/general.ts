import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import type { ActionResult, ActionRun, PageModule } from "../types";

type Item = Record<string, unknown>;

const themes = [
  { id: "dark", label: "Dark", default: true },
  { id: "light", label: "Light", default: false },
  { id: "midnight", label: "Midnight", default: false },
  { id: "forest", label: "Forest", default: false },
  { id: "contrast", label: "High contrast", default: false },
];

const joinModeLabels: Record<string, string> = {
  open: "Open to join",
  confirmed: "Approval required",
};

const joinModeSummaries: Record<string, string> = {
  open: "Make joining open to everyone",
  confirmed: "Make joining approval-only",
};

const isRecord = (value: unknown): value is Item => typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value : "");

const labelOf = (mode: string) => (Object.hasOwn(joinModeLabels, mode) ? joinModeLabels[mode] : "");

const joinModeOf = (answer: unknown) => {
  if (typeof answer === "string") return answer;
  return isRecord(answer) ? text(answer.join_mode) || text(answer.mode) : "";
};

const languageEntries = (answer: unknown): Item[] =>
  isRecord(answer) && Array.isArray(answer.languages) ? answer.languages.filter(isRecord) : [];

const languageCodesOf = (answer: unknown) => languageEntries(answer).map((entry) => text(entry.code));

const defaultLanguageOf = (answer: unknown) => {
  if (!isRecord(answer)) return "";
  return text(answer.default) || text(languageEntries(answer).find((entry) => entry.default === true)?.code);
};

const rows = async (hubId: string): Promise<PageRow[]> => {
  const joinMode = await callTool<unknown>(hubId, "instance_get_join_mode");
  const languages = await callTool<unknown>(hubId, "instance_get_languages");
  const mode = joinModeOf(joinMode);
  return [
    {
      joining: mode,
      joining_label: labelOf(mode),
      default_language: defaultLanguageOf(languages),
      languages: languageCodesOf(languages),
      theme: "dark",
      themes,
      pending_writes: ["joining"],
    },
  ];
};

const propose = async (hubId: string, kind: string, summary: string, payload: Item): Promise<ActionResult> => {
  await callTool(hubId, "agency_propose_write", { kind, summary, payload: JSON.stringify(payload) });
  return "accepted";
};

const changeJoinMode: ActionRun = async (hubId, values) => {
  const mode = text(values.join_mode);
  if (!Object.hasOwn(joinModeSummaries, mode)) throw new Error("joining must be open or confirmed");
  return propose(hubId, "instance_set_join_mode", joinModeSummaries[mode], { join_mode: mode });
};

const contentLanguagesOf = (settings: Item) =>
  Array.isArray(settings.content) ? settings.content.filter((code): code is string => typeof code === "string") : [];

const changeLanguage: ActionRun = async (hubId, values) => {
  const code = text(values.language).trim();
  if (!code) throw new Error("choose a language code");
  const settings = await callTool<unknown>(hubId, "instance_get_languages");
  if (!isRecord(settings)) throw new Error("instance_get_languages: the answer was not the language settings");
  const content = contentLanguagesOf(settings);
  return propose(hubId, "instance_set_languages", "Make " + code + " the default language", {
    studio_default: text(settings.studio_default),
    content: content.includes(code) ? content : [...content, code],
    content_default: code,
  });
};

export const generalPage: PageModule = {
  spec: {
    id: "general",
    title: "General",
    primary: "Save changes",
    tools: ["instance_get_join_mode", "instance_get_languages"],
    columns: [
      { key: "joining", label: "Joining" },
      { key: "default_language", label: "Default language" },
      { key: "theme", label: "Theme" },
    ],
  },
  rows,
  actions: { general: changeJoinMode, language: changeLanguage },
};
