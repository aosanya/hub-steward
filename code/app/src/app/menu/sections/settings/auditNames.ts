import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { labelOf, shortId } from "./personLabel";

export type AuditEntry = { id: string; at: string; action: string; subject: string; actor: string };

const grantedRole = "granted a role";
const publishedForm = "published a form";
const rowActions = ["added a row", "corrected a row"];

const distinct = (values: string[]) => [...new Set(values.filter((value) => value !== ""))];

const actorIdsOf = (entries: AuditEntry[]) =>
  distinct(entries.flatMap((entry) => (entry.action === grantedRole ? [entry.actor, entry.subject] : [entry.actor])));

const formIdsOf = (entries: AuditEntry[]) => distinct(entries.filter((entry) => entry.action === publishedForm).map((entry) => entry.subject));

const actorLabels = async (ids: string[]) => {
  if (ids.length === 0) return new Map<string, string>();
  const people = await callTool("", "actor_get_actors", { id: ids }).then(itemsOf, () => []);
  return new Map(people.map((person) => [String(person.id), labelOf(person)]));
};

const formTitle = async (formId: string) => {
  const form = await callTool("", "forms_form_read", { form_id: formId }).catch(() => null);
  const title = (form as { title?: unknown } | null)?.title;
  return [formId, typeof title === "string" && title.trim() !== "" ? title : shortId(formId)] as const;
};

export const auditNames = async (entries: AuditEntry[]) => {
  const [actors, titles] = await Promise.all([actorLabels(actorIdsOf(entries)), Promise.all(formIdsOf(entries).map(formTitle))]);
  const forms = new Map(titles);
  const actorName = (id: string) => (id === "" ? "" : (actors.get(id) ?? shortId(id)));
  const subjectName = (entry: AuditEntry) => {
    if (entry.action === grantedRole) return actorName(entry.subject);
    if (entry.action === publishedForm) return forms.get(entry.subject) ?? entry.subject;
    return rowActions.includes(entry.action) ? "" : entry.subject;
  };
  return { actorName, subjectName };
};
