import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuList } from "../../MenuList";
import { auditRowsOf } from "./auditRows";

const loadEntries = async () => auditRowsOf(itemsOf(await callTool("", "audit_list_entries")));

export function AuditLog() {
  const word = useWord();
  return <MenuList title={word("Audit Log")} tool="audit_list_entries" load={loadEntries} fields={{ title: "what", meta: "who" }} empty={{ words: "Nothing has been recorded yet." }} />;
}
