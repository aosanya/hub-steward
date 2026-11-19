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

const groupIdsOf = async (personId: string) => {
  const reply = (await callTool("", "actor_list_groups_for_actor", { actor_id: personId })) as { items?: unknown } | null;
  const rows = Array.isArray(reply?.items) ? reply.items.filter(isItem) : [];
  return new Set(rows.map((row) => text(row, "group_id")).filter((id) => id !== ""));
};

const reachesThrough = async (form: FormTitle, groups: Set<string>) => {
  const reply = (await callTool("", "forms_target_list", { form_id: form.id })) as { items?: unknown } | null;
  const targets = Array.isArray(reply?.items) ? reply.items.filter(isItem) : [];
  return targets.some((target) => groups.has(text(target, "chapter_id")) || target.includes_descendants === true);
};

export const loadFormsReaching = async (personId: string): Promise<FormTitle[]> => {
  const [forms, groups] = await Promise.all([loadFormList(), groupIdsOf(personId)]);
  const reached = await Promise.all(forms.map((form) => reachesThrough(form, groups)));
  return forms.filter((_, index) => reached[index]);
};
