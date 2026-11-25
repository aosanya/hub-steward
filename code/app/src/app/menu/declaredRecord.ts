import { loadLiveRecords, loadLiveRows, recordWithKey, textOf, type Raw } from "../../shared/wakala/liveRecords";
import { recordRowsOf, type RecordRow } from "./liveRecordRows";
import type { RecordFormField } from "./RecordRowForm";

export type Condition = { question: string; operator: string; value: string | { row: string } };

export type PlainCondition = { question: string; operator: string; value: string };

export type Question = { prompt: string; answerType: string; required: boolean; options: string[]; optionsFrom: string };

export type DeclaredRecord = { key: string; name: string; canAdd: boolean; workflowId: string; questions: Question[] };

export type DeclaredRow = { id: string; orderId: string; answers: Record<string, string> };

const unsupportedAnswerTypes = ["photo", "file", "time_range", "address"];

const questionOf = (raw: Raw): Question => ({
  prompt: textOf(raw.prompt),
  answerType: textOf(raw.answer_type) || "free_text",
  required: raw.required === true,
  options: Array.isArray(raw.options) ? raw.options.filter((option): option is string => typeof option === "string") : [],
  optionsFrom: textOf(raw.options_from),
});

const declaredOf = (raw: Raw): DeclaredRecord => ({
  key: textOf(raw.key),
  name: textOf(raw.name),
  canAdd: raw.can_add_rows === true,
  workflowId: textOf(raw.workflow_id),
  questions: (Array.isArray(raw.questions) ? (raw.questions as Raw[]).map(questionOf) : []).filter((question) => question.prompt !== ""),
});

const rowOf = (row: Raw): DeclaredRow => ({
  id: textOf(row.id),
  orderId: textOf(row.order_id),
  answers: Object.fromEntries(Object.entries((row.answers ?? {}) as Raw).map(([prompt, answer]) => [prompt, typeof answer === "string" || typeof answer === "number" ? String(answer).trim() : ""])),
});

export const loadDeclaredRecord = async (key: string): Promise<DeclaredRecord | null> => {
  const kept = recordWithKey(await loadLiveRecords(), key);
  return kept ? declaredOf(kept) : null;
};

export const loadRecordWorkflows = async (): Promise<Record<string, string>> =>
  Object.fromEntries((await loadLiveRecords()).filter((record) => textOf(record.key) !== "" && textOf(record.workflow_id) !== "").map((record) => [textOf(record.key), textOf(record.workflow_id)]));

const rowsOfRecord = async (kept: Raw, where: PlainCondition[]): Promise<DeclaredRow[]> => (await loadLiveRows(kept, where.length > 0 ? { where } : {})).map(rowOf);

export const loadDeclaredRows = async (key: string, where: PlainCondition[]): Promise<DeclaredRow[]> => {
  const kept = recordWithKey(await loadLiveRecords(), key);
  return kept ? rowsOfRecord(kept, where) : [];
};

export type LoadedRow = { record: DeclaredRecord; row: DeclaredRow; position: number };

export const loadDeclaredRow = async (key: string, rowId: string): Promise<LoadedRow | null> => {
  const kept = recordWithKey(await loadLiveRecords(), key);
  if (!kept) return null;
  const rows = await rowsOfRecord(kept, []);
  const at = rows.findIndex((row) => row.id === rowId);
  return at >= 0 ? { record: declaredOf(kept), row: rows[at], position: at + 1 } : null;
};

export const isUnsupported = (question: Question) => unsupportedAnswerTypes.includes(question.answerType);

export const mayAddRowsTo = (record: DeclaredRecord) => record.canAdd && record.questions.length > 0 && !record.questions.some((question) => question.required && isUnsupported(question));

export const formFieldOf = (question: Question): RecordFormField | null => {
  if (isUnsupported(question)) return null;
  const base = { prompt: question.prompt, required: question.required };
  if (question.optionsFrom === "members") return { ...base, people: true };
  if (question.answerType === "yes_no") return { ...base, options: ["Yes", "No"] };
  if (question.answerType === "single_choice") return { ...base, options: question.options };
  if (question.answerType === "multi_select") return { ...base, options: question.options, multi: true };
  if (question.answerType === "number" || question.answerType === "currency") return { ...base, kind: "number" };
  if (question.answerType === "date") return { ...base, kind: "date" };
  if (question.answerType === "time") return { ...base, kind: "time" };
  return base;
};

export const formFieldsOf = (record: DeclaredRecord): RecordFormField[] => record.questions.flatMap((question) => formFieldOf(question) ?? []);

export const titlePromptOf = (record: DeclaredRecord) => record.questions[0]?.prompt ?? "";

export const metaPromptsOf = (record: DeclaredRecord) => record.questions.slice(1, 3).map((question) => question.prompt);

export const rowTitleOf = (record: DeclaredRecord, row: DeclaredRow, position: number) =>
  record.questions.map((question) => row.answers[question.prompt] ?? "").find((answer) => answer !== "") ?? `${record.name} ${position}`;

export const listRowsOf = (record: DeclaredRecord, rows: DeclaredRow[]): RecordRow[] => {
  const raw = rows.map((row) => ({ id: row.id, answers: row.answers }));
  const meta = recordRowsOf(raw, titlePromptOf(record), metaPromptsOf(record));
  return rows.map((row, index) => ({ ...meta[index], title: rowTitleOf(record, row, index + 1) }));
};

export const resolveWhere = (where: Condition[], row: DeclaredRow | null): PlainCondition[] | null => {
  const resolved = where.map((condition) => ({ ...condition, value: typeof condition.value === "string" ? condition.value : (row?.answers[condition.value.row] ?? "") }));
  const missing = where.some((condition, index) => typeof condition.value !== "string" && resolved[index].value === "");
  return missing ? null : resolved;
};

export const prefillOf = (where: PlainCondition[]) => Object.fromEntries(where.filter((condition) => condition.operator === "is").map((condition) => [condition.question, condition.value]));

export const loadDeclaredMayAdd = async (key: string) => {
  const record = await loadDeclaredRecord(key);
  return record !== null && mayAddRowsTo(record);
};
