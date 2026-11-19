import { callTool } from "../../shared/wakala/mcp";
import { text, type Item } from "./sections/staff/staffData";

export type FormTitle = { id: string; title: string };

const isItem = (value: unknown): value is Item => typeof value === "object" && value !== null;

export const loadFormList = async (): Promise<FormTitle[]> => {
  const reply = (await callTool("", "forms_form_list")) as { rows?: unknown } | null;
  const rows = Array.isArray(reply?.rows) ? reply.rows.filter(isItem) : [];
  return rows
    .map((row) => (isItem(row.form) ? row.form : row))
    .map((form) => ({ id: text(form, "id"), title: text(form, "title") }))
    .filter((form) => form.id !== "" && form.title !== "");
};

export const loadFormsReaching = async (personId: string): Promise<FormTitle[]> => {
  const reply = (await callTool("", "forms_form_list_reaching_person", { person_id: personId })) as { items?: unknown } | null;
  const rows = Array.isArray(reply?.items) ? reply.items.filter(isItem) : [];
  return rows.map((form) => ({ id: text(form, "id"), title: text(form, "title") })).filter((form) => form.id !== "" && form.title !== "");
};
