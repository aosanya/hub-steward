import { vi } from "vitest";
import * as mcp from "./mcp";

export type FakeQuestion = { prompt: string; key?: string; code?: string; answer_type?: string; required?: boolean; options?: string[]; options_from?: string };

export type FakeRecord = { key: string; code: string; name: string; can_add_rows?: boolean; workflow_id?: string; questions: (string | FakeQuestion)[] };

export type FakeRow = { id: string; answers: Record<string, string>; [more: string]: unknown };

export const uuidKey = "6f1c2a9e-4b7d-4e0a-9c35-2d8f1a7b3c40";

export const fieldKeyOf = (prompt: string) => {
  let hash = 5381;
  for (const letter of prompt) hash = (hash * 33 + letter.charCodeAt(0)) % 0xffffffff;
  return `f_${hash.toString(16).padStart(8, "0")}${hash.toString(16).split("").reverse().join("").padStart(8, "0")}`;
};

const questionOf = (question: string | FakeQuestion) => {
  const given = typeof question === "string" ? { prompt: question } : question;
  return { answer_type: "free_text", required: false, ...given, key: given.key ?? fieldKeyOf(given.prompt), code: given.code ?? given.prompt.toLowerCase().replace(/\W+/g, "_") };
};

export const recordServed = (record: FakeRecord) => ({
  key: record.key,
  code: record.code,
  name: record.name,
  can_add_rows: record.can_add_rows ?? false,
  workflow_id: record.workflow_id ?? "",
  questions: record.questions.map(questionOf),
});

export const rowServed = (record: FakeRecord, row: FakeRow) => {
  const keyOf = (prompt: string) => record.questions.map(questionOf).find((question) => question.prompt === prompt)?.key ?? prompt;
  return { ...row, record_code: record.key, answers: Object.fromEntries(Object.entries(row.answers).map(([prompt, answer]) => [keyOf(prompt), answer])) };
};

export const answersKeyed = (record: FakeRecord, answers: Record<string, string>) => rowServed(record, { id: "", answers }).answers;

export type LiveHub = { records: FakeRecord[]; rows?: Record<string, FakeRow[]>; otherwise?: (tool: string, args: Record<string, unknown>) => unknown };

export const liveRecordsHub = (hub: LiveHub) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, tool, args) => {
    const given = (args ?? {}) as Record<string, unknown>;
    if (tool === "agency_list_live_records") return { items: hub.records.map(recordServed) };
    if (tool === "agency_list_live_record_rows") {
      const record = hub.records.find((one) => one.key === given.record_code || one.code === given.record_code);
      return { items: record ? (hub.rows?.[record.key] ?? []).map((row) => rowServed(record, row)) : [] };
    }
    if (tool === "agency_add_live_record_row") return { id: "r-new" };
    return hub.otherwise ? hub.otherwise(tool, given) : { items: [] };
  });

export const rowsAsked = (hub: ReturnType<typeof liveRecordsHub>) =>
  hub.mock.calls.filter(([, tool]) => tool === "agency_list_live_record_rows").map(([, , args]) => args as Record<string, unknown>);

export const rowsSaved = (hub: ReturnType<typeof liveRecordsHub>) =>
  hub.mock.calls.filter(([, tool]) => tool === "agency_add_live_record_row").map(([, , args]) => args as Record<string, unknown>);
