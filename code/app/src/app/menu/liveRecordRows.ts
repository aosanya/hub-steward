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

export async function loadRecordRows(recordCode: string, titlePrompt: string, metaPrompts: string[]): Promise<RecordRow[]> {
  try {
    return recordRowsOf(itemsOf(await callTool("", liveRecordRowsTool, { record_code: recordCode })) as Raw[], titlePrompt, metaPrompts);
  } catch (error) {
    if (error instanceof Error && absentRecord.test(error.message)) return [];
    throw error;
  }
}
