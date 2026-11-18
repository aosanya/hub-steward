import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { loadRowChain } from "../../liveRecordRows";
import { auditRowsOf } from "../settings/auditRows";

const loadRowActivity = (recordCode: string, rowId: string) => async () => {
  const chain = await loadRowChain(recordCode, rowId);
  const answers = await Promise.all(chain.map((subject) => callTool("", "audit_list_entries", { subject }).then(itemsOf)));
  const distinct = new Map(answers.flat().map((entry) => [entry.id, entry]));
  const rows = await auditRowsOf([...distinct.values()]);
  return rows.map((row) => ({ key: row.id, title: row.what, meta: row.who }));
};

export function RowActivity({ recordCode, rowId }: { recordCode: string; rowId: string }) {
  const word = useWord();
  const view = useLoad(loadRowActivity(recordCode, rowId), `row-activity:${openAgencyId()}:${recordCode}:${rowId}`);
  if (view.state !== "ready" || view.data.length === 0) return null;
  return <Section icon="clock" all word={word("Activity")} rows={view.data.map((row) => <ListRow key={row.key} title={row.title} meta={row.meta} />)} />;
}
