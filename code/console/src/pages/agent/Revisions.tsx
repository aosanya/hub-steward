import { useState } from "react";
import { agentRevisions, restoreAgentRevision, type Revision, type RevisionRows } from "../../data/agent";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Button, DataTable, Empty, FromChat, Toolbar } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";

type RevisionActions = { role: string; onRestored: () => void; onRestoreFailed: () => void };

const savedBy = (revision: Revision) => revision.saved_by || revision.created_by || revision.by || "";
const savedAt = (revision: Revision) => revision.saved_at || revision.created_at || revision.at || "";
const savedOf = (revision: Revision) => [savedBy(revision), savedAt(revision)].filter(Boolean).join(", ");

function RevisionList({ role, onRestored, onRestoreFailed }: RevisionActions) {
  const { hub } = useConsole();
  const { t } = useI18n();
  const { state: revisions } = useLoaded<RevisionRows>(() => agentRevisions(hub.id, role), [hub.id, role]);

  const restore = async (id: string | number) => {
    const ok = await restoreAgentRevision(hub.id, role, String(id)).then(
      () => true,
      () => false,
    );
    if (ok) onRestored();
    else onRestoreFailed();
  };

  if (revisions.kind === "loading") return null;
  if (revisions.kind === "failed") return <Empty failed text={t("loadFailed")} />;
  const rows = revisions.value.rows ?? [];
  return (
    <DataTable
      columns={[t("agent.colVersion"), t("agent.colSaved")]}
      empty={t("instrNoEarlier")}
      rows={rows.map((revision, index) => ({
        key: String(revision.id),
        cells: [t("agent.version").replace("{n}", String(rows.length - index)), savedOf(revision)],
        actions: (
          <Button kind="quiet" size="sm" onClick={() => restore(revision.id)}>
            {t("instrRestore")}
          </Button>
        ),
      }))}
    />
  );
}

export function Revisions(props: RevisionActions) {
  const { t } = useI18n();
  const [asked, setAsked] = useState(0);

  if (!asked) {
    return (
      <Toolbar
        left={
          <Button kind="quiet" size="sm" onClick={() => setAsked(1)}>
            {t("instrShowEarlier")}
          </Button>
        }
      />
    );
  }
  return (
    <FromChat prompt={t("instrShowEarlier")} onClear={() => setAsked(0)}>
      <RevisionList {...props} />
    </FromChat>
  );
}
