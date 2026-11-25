import { callTool } from "./mcp";

export const liveRecordsTool = "agency_list_live_records";

export const liveRecordRowsTool = "agency_list_live_record_rows";

export const addLiveRecordRowTool = "agency_add_live_record_row";

export type Raw = Record<string, unknown>;

export const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const isObject = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);

const itemsOf = (reply: unknown): Raw[] => {
  const items = Array.isArray(reply) ? reply : (reply as Raw | null)?.items;
  return Array.isArray(items) ? items.filter(isObject) : [];
};

export const loadLiveRecords = async (): Promise<Raw[]> => itemsOf(await callTool("", liveRecordsTool));

export const recordWithKey = (records: Raw[], key: string) => records.find((record) => textOf(record.key) === key);

export const recordNamed = (records: Raw[], name: string) => records.find((record) => record.name === name);

export const questionsOf = (record: Raw): Raw[] => (Array.isArray(record.questions) ? record.questions.filter(isObject) : []);

export const fieldKeyOf = (record: Raw, prompt: string) => textOf(questionsOf(record).find((question) => question.prompt === prompt)?.key);

export const answersByPrompt = (record: Raw, row: Raw): Raw => {
  const stored = isObject(row.answers) ? row.answers : {};
  const fields = questionsOf(record).filter((question) => textOf(question.key) !== "");
  const keys = new Set(fields.map((question) => textOf(question.key)));
  const unkeyed = Object.fromEntries(Object.entries(stored).filter(([name]) => !keys.has(name)));
  const keyed = Object.fromEntries(fields.flatMap((question) => (textOf(question.key) in stored ? [[textOf(question.prompt), stored[textOf(question.key)]]] : [])));
  return { ...unkeyed, ...keyed };
};

export const answersByKey = (record: Raw, answers: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(answers).map(([prompt, answer]) => [fieldKeyOf(record, prompt) || prompt, answer]));

export const loadLiveRows = async (record: Raw, args: Raw = {}): Promise<Raw[]> =>
  itemsOf(await callTool("", liveRecordRowsTool, { record_code: textOf(record.key), ...args })).map((row) => ({ ...row, answers: answersByPrompt(record, row) }));

export const addLiveRow = (record: Raw, answers: Record<string, string>, more: Raw = {}) =>
  callTool("", addLiveRecordRowTool, { record_code: textOf(record.key), answers: answersByKey(record, answers), ...more });
