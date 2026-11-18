import { dateTimeWords } from "../../../../shared/ui/days";
import { auditNames, type AuditEntry } from "./auditNames";

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const newestFirst = (left: { at: string }, right: { at: string }) => Date.parse(right.at) - Date.parse(left.at) || 0;

const kinds: [RegExp, string][] = [
  [/form/i, "Forms"],
  [/row/i, "Rows"],
  [/consent/i, "Consent"],
  [/role|group|seat/i, "Groups"],
];

const kindOf = (action: string) => kinds.find(([pattern]) => pattern.test(action))?.[1] ?? "Other";

export const auditRowsOf = async (items: ({ id: string } & Record<string, unknown>)[]) => {
  const entries: AuditEntry[] = items
    .map((entry) => ({ id: entry.id, at: textOf(entry.at), action: textOf(entry.action), subject: textOf(entry.subject), actor: textOf(entry.actor) }))
    .sort(newestFirst);
  const { actorName, subjectName } = await auditNames(entries);
  return entries.map((entry) => ({
    id: entry.id,
    kind: kindOf(entry.action),
    what: [entry.action, subjectName(entry)].filter((part) => part !== "").join(": "),
    who: [actorName(entry.actor), dateTimeWords(entry.at) ?? entry.at].filter((part) => part !== "").join(" · "),
    subject: entry.subject === "" ? entry.id : entry.subject,
  }));
};
