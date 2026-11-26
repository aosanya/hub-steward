import type { FieldComponent, FieldSpec, PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import type { PageModule } from "../types";
import { isRecord, itemsOf, textOf } from "./groups";

export type Question = { prompt: string; answerType: string; required: boolean; options: string[] };

export type LiveRecord = { key: string; code: string; name: string; formName: string; questions: Question[]; canAddRows: boolean };

export type RecordRow = { id: string; answers: Record<string, string> };

const questionOf = (raw: Record<string, unknown>): Question => ({
  prompt: textOf(raw, "prompt"),
  answerType: textOf(raw, "answer_type"),
  required: raw.required === true,
  options: Array.isArray(raw.options) ? raw.options.filter((option): option is string => typeof option === "string") : [],
});

const recordOf = (raw: Record<string, unknown>): LiveRecord => ({
  key: textOf(raw, "key") || textOf(raw, "code"),
  code: textOf(raw, "code"),
  name: textOf(raw, "name"),
  formName: textOf(raw, "form_name"),
  questions: (Array.isArray(raw.questions) ? raw.questions : []).filter(isRecord).map(questionOf),
  canAddRows: raw.can_add_rows === true,
});

const rowOf = (raw: Record<string, unknown>): RecordRow => ({
  id: textOf(raw, "id"),
  answers: isRecord(raw.answers) ? Object.fromEntries(Object.entries(raw.answers).map(([prompt, answer]) => [prompt, String(answer ?? "")])) : {},
});

export const listRecords = async (hubId: string): Promise<LiveRecord[]> =>
  itemsOf(await callTool<unknown>(hubId, "agency_list_live_records")).map(recordOf);

export const listRows = async (hubId: string, recordCode: string): Promise<RecordRow[]> =>
  itemsOf(await callTool<unknown>(hubId, "agency_list_live_record_rows", { record_code: recordCode })).map(rowOf);

export const addRow = async (hubId: string, recordCode: string, answers: Record<string, string>): Promise<void> => {
  await callTool(hubId, "agency_add_live_record_row", { record_code: recordCode, answers });
};

const componentOf = (question: Question): FieldComponent => {
  switch (question.answerType) {
    case "single_choice":
      return question.options.length > 0 ? "radios" : "text";
    case "multi_select":
      return "chips";
    case "number":
    case "currency":
      return "number";
    case "date":
      return "date";
    case "yes_no":
      return "toggle";
    default:
      return "text";
  }
};

export const fieldsOf = (questions: Question[]): FieldSpec[] =>
  questions.map((question) => {
    const component = componentOf(question);
    const field: FieldSpec = { name: question.prompt, component, required: question.required };
    return component === "radios" || component === "chips" ? { ...field, options: question.options } : field;
  });

const answerText = (field: FieldSpec, value: unknown): string => {
  if (field.component === "toggle") return value === true ? "yes" : "no";
  return value === undefined || value === null ? "" : String(value).trim();
};

export const answersOf = (fields: FieldSpec[], values: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(fields.map((field) => [field.name, answerText(field, values[field.name])]));

const recordRows = async (hubId: string): Promise<PageRow[]> =>
  (await listRecords(hubId)).map((record) => ({ id: record.code, record: record.name, form: record.formName }));

export const recordsPage: PageModule = {
  spec: {
    id: "records",
    title: "Records",
    primary: "Add a row",
    tools: ["agency_list_live_records", "agency_list_live_record_rows", "agency_add_live_record_row"],
    columns: [
      { key: "record", label: "Record" },
      { key: "form", label: "Form" },
    ],
  },
  rows: recordRows,
};
