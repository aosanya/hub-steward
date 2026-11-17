import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { dateTimeWords } from "../../../../shared/ui/days";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuList } from "../../MenuList";
import { auditNames, type AuditEntry } from "./auditNames";

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const newestFirst = (left: { at: string }, right: { at: string }) => Date.parse(right.at) - Date.parse(left.at) || 0;

const loadEntries = async () => {
  const entries: AuditEntry[] = itemsOf(await callTool("", "audit_list_entries"))
    .map((entry) => ({ id: entry.id, at: textOf(entry.at), action: textOf(entry.action), subject: textOf(entry.subject), actor: textOf(entry.actor) }))
    .sort(newestFirst);
  const { actorName, subjectName } = await auditNames(entries);
  return entries.map((entry) => ({
    id: entry.id,
    what: [entry.action, subjectName(entry)].filter((part) => part !== "").join(": "),
    who: [actorName(entry.actor), dateTimeWords(entry.at) ?? entry.at].filter((part) => part !== "").join(" · "),
  }));
};

export function AuditLog() {
  const word = useWord();
  return <MenuList title={word("Audit Log")} tool="audit_list_entries" load={loadEntries} fields={{ title: "what", meta: "who" }} empty={{ words: "Nothing has been recorded yet." }} />;
}
