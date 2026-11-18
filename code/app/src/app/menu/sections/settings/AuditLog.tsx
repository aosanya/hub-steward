import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { loadFailedWords } from "../../MenuList";
import { PageFrame } from "../../PageFrame";
import { useBackToSection } from "../../useBackToSection";
import { auditRowsOf } from "./auditRows";

const loadEntries = async () => auditRowsOf(itemsOf(await callTool("", "audit_list_entries")));

export function AuditLog() {
  const back = useBackToSection();
  const word = useWord();
  const view = useLoad(loadEntries, `audit-log:${openAgencyId()}`);
  return (
    <Shell title={word("Audit Log")} onBack={back.onBack} backLabel={back.backLabel}>
      <PageFrame title={word("Audit Log")}>
        {view.state === "loading" ? <LoadingLine /> : null}
        {view.state === "error" ? <LoadFailed words={loadFailedWords} /> : null}
        {view.state === "ready" ? (
          <Section
            word="Recent changes"
            full
            icon="document"
            empty={{ words: "Nothing has been recorded yet." }}
            rows={view.data.map((entry) => <ListRow key={entry.id} title={entry.what} meta={entry.who} status={entry.kind} />)}
          />
        ) : null}
      </PageFrame>
    </Shell>
  );
}
