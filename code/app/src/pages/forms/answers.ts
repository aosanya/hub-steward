import type { Answer, FormQuestion } from "../../forms/api";

export type Given = { text: string; options: string[]; files?: string[] };
export type Draft = Record<string, Given>;

export const given = (q: FormQuestion, d: Draft): Given => d[q.id] ?? { text: "", options: [] };

export const isChoice = (q: FormQuestion) => q.answer_type === "single_choice" || q.answer_type === "multi_select" || (q.options.length > 0 && q.answer_type !== "yes_no");

export const isFile = (q: FormQuestion) => q.answer_type === "photo" || q.answer_type === "file";

export const filesOf = (v: Given): string[] => v.files ?? (v.text.trim() !== "" ? [v.text.trim()] : []);

export const fileLimit = (q: FormQuestion) => (q.max_files && q.max_files > 0 ? q.max_files : 1);

export const filled = (q: FormQuestion, d: Draft) => {
  const v = given(q, d);
  if (isFile(q)) return filesOf(v).length > 0;
  return isChoice(q) ? v.options.length > 0 : v.text.trim() !== "";
};

export const toAnswer = (q: FormQuestion, d: Draft): Answer => {
  const v = given(q, d);
  if (isChoice(q)) return { question_id: q.id, option_ids: v.options };
  const text = v.text.trim();
  if (isFile(q)) return { question_id: q.id, file_ids: filesOf(v) };
  if (q.answer_type === "yes_no") return { question_id: q.id, value_bool: text === "yes" };
  if (q.answer_type === "number" || q.answer_type === "currency") return { question_id: q.id, value_number: Number(text) };
  if (q.answer_type === "date") return { question_id: q.id, value_date: text };
  if (q.answer_type === "time") return { question_id: q.id, value_time: text };
  return { question_id: q.id, value_text: text };
};

export const toAnswers = (qs: FormQuestion[], d: Draft): Answer[] => qs.filter((q) => filled(q, d)).map((q) => toAnswer(q, d));

export const shown = (q: FormQuestion, d: Draft) => {
  const v = given(q, d);
  if (isChoice(q)) return q.options.filter((o) => v.options.includes(o.id)).map((o) => o.label).join(", ");
  if (isFile(q)) return filesOf(v).join(", ");
  if (q.answer_type === "yes_no") return v.text === "yes" ? (q.yes_label ?? "Yes") : v.text === "no" ? (q.no_label ?? "No") : "";
  return v.text.trim();
};

export const threadLines = (qs: FormQuestion[], d: Draft) =>
  qs.filter((q) => filled(q, d)).map((q) => `${q.prompt}: ${shown(q, d)}`);

const keyOf = (formId: string) => `hs-form-draft-${formId}`;

export const loadDraft = (formId: string): Draft => {
  try {
    return JSON.parse(window.localStorage.getItem(keyOf(formId)) ?? "{}");
  } catch {
    return {};
  }
};

export const saveDraft = (formId: string, d: Draft) => {
  try {
    window.localStorage.setItem(keyOf(formId), JSON.stringify(d));
  } catch {
    return;
  }
};

export const clearDraft = (formId: string) => {
  try {
    window.localStorage.removeItem(keyOf(formId));
  } catch {
    return;
  }
};

export const draftCount = (formId: string) =>
  Object.values(loadDraft(formId)).filter((g) => g.text.trim() !== "" || g.options.length > 0 || (g.files?.length ?? 0) > 0).length;
