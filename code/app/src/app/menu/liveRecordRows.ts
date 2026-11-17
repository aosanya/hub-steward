import { itemsOf } from "../../features/backlogs";
import { callTool } from "../../shared/wakala/mcp";

export const liveRecordRowsTool = "agency_list_live_record_rows";

export type RecordRow = { id: string; title: string; meta: string };

type Raw = Record<string, unknown>;

const absentRecord = /(record|instance) not found/i;

const answerOf = (row: Raw, prompt: string) => {
  const value = (row.answers as Raw | undefined)?.[prompt];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
};

export const recordRowsOf = (rows: Raw[], titlePrompt: string, metaPrompts: string[]): RecordRow[] =>
  rows.map((row) => ({
    id: typeof row.id === "string" ? row.id : "",
    title: answerOf(row, titlePrompt),
    meta: metaPrompts.map((prompt) => answerOf(row, prompt)).filter(Boolean).join(" · "),
  }));

const loadRawRows = async (recordCode: string, args: Raw = {}): Promise<Raw[]> => {
  try {
    return itemsOf(await callTool("", liveRecordRowsTool, { record_code: recordCode, ...args })) as Raw[];
  } catch (error) {
    if (error instanceof Error && absentRecord.test(error.message)) return [];
    throw error;
  }
};

export const loadRecordRows = async (recordCode: string, titlePrompt: string, metaPrompts: string[]): Promise<RecordRow[]> =>
  recordRowsOf(await loadRawRows(recordCode), titlePrompt, metaPrompts);

export const loadRecordRowsHeldBy = async (recordCode: string, titlePrompt: string, metaPrompts: string[], actorId: string): Promise<RecordRow[]> =>
  recordRowsOf(await loadRawRows(recordCode, { answer_actor_id: actorId }), titlePrompt, metaPrompts);

export const loadRecordRow = async (recordCode: string, id: string, prompts: string[]): Promise<Record<string, string>> => {
  const row = (await loadRawRows(recordCode)).find((one) => one.id === id);
  return row ? Object.fromEntries(prompts.map((prompt) => [prompt, answerOf(row, prompt)])) : {};
};
