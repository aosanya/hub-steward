import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import type { ActionResult, ActionRun, PageModule, Query } from "../types";

type Item = Record<string, unknown>;

type Source = { id: string; title: string; updatedAt: string; languages: string[] };

type Group = { title: string; languages: Set<string>; passages: number; updated: string };

const isRecord = (value: unknown): value is Item => typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value : "");

const trimmed = (values: Item, key: string) => text(values[key]).trim();

const listOf = (answer: unknown): unknown[] => {
  if (Array.isArray(answer)) return answer;
  return isRecord(answer) && Array.isArray(answer.items) ? answer.items : [];
};

const languagesOf = (properties: unknown): string[] => {
  if (!isRecord(properties)) return [];
  if (Array.isArray(properties.languages)) {
    return properties.languages.filter((code): code is string => typeof code === "string" && code !== "");
  }
  return typeof properties.language === "string" && properties.language !== "" ? [properties.language] : [];
};

const sourceOf = (item: Item): Source => ({
  id: text(item.id),
  title: text(item.title),
  updatedAt: text(item.updated_at),
  languages: languagesOf(item.properties),
});

const passagesIn = async (hubId: string, source: Source) =>
  listOf(await callTool<unknown>(hubId, "sources_chunk_list", { sourceID: source.id })).length;

const groupByTitle = (sources: Source[], passages: number[]): Group[] => {
  const groups = new Map<string, Group>();
  sources.forEach((source, index) => {
    const group = groups.get(source.title) ?? { title: source.title, languages: new Set<string>(), passages: 0, updated: "" };
    groups.set(source.title, group);
    source.languages.forEach((code) => group.languages.add(code));
    if (source.updatedAt > group.updated) group.updated = source.updatedAt;
    group.passages += passages[index];
  });
  return [...groups.values()];
};

const rows = async (hubId: string, query: Query): Promise<PageRow[]> => {
  const answer = await callTool<unknown>(hubId, "sources_source_list");
  const sources = listOf(answer).filter(isRecord).map(sourceOf);
  const passages = await Promise.all(sources.map((source) => passagesIn(hubId, source)));
  const search = (query.search ?? "").trim().toLowerCase();
  const language = (query.language ?? "").trim();
  return groupByTitle(sources, passages)
    .filter((group) => !search || group.title.toLowerCase().includes(search))
    .filter((group) => !language || group.languages.has(language))
    .map((group) => ({
      document: group.title,
      languages: [...group.languages].sort().join(", "),
      passages: group.passages,
      updated: group.updated,
    }));
};

const propose = async (hubId: string, kind: string, summary: string, payload: Item): Promise<ActionResult> => {
  await callTool(hubId, "agency_propose_write", { kind, summary, payload: JSON.stringify(payload) });
  return "accepted";
};

const uploadDocument: ActionRun = async (hubId, values) => {
  const title = trimmed(values, "title");
  if (!title) throw new Error("title is required");
  const body = trimmed(values, "text");
  if (!body) throw new Error("text is required");
  return propose(hubId, "sources_document_create", "Add the document " + title, {
    title,
    language: trimmed(values, "language"),
    text: body,
  });
};

export const documentsPage: PageModule = {
  spec: {
    id: "documents",
    title: "Documents",
    primary: "Upload a document",
    tools: ["sources_source_list", "sources_chunk_list", "sources_document_create"],
    columns: [
      { key: "document", label: "Document" },
      { key: "languages", label: "Languages" },
      { key: "passages", label: "Passages" },
      { key: "updated", label: "Updated" },
    ],
  },
  rows,
  actions: { documents: uploadDocument },
};
