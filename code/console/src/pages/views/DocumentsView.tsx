import { useState } from "react";
import { useConsole } from "../../shell/context";
import { TitleRow } from "../../ui";
import { useI18n } from "../../i18n";
import { DocumentsList } from "../spec/documentsList";
import { UploadForm } from "../spec/documentsUpload";
import { useOutcomeNote } from "../spec/profileOutcome";
import type { Outcome } from "../spec/sendAction";
import { useSpecPage } from "../spec/useSpecPage";

export function DocumentsView() {
  const { hub } = useConsole();
  return <DocumentsPage key={hub.id} hubId={hub.id} />;
}

function DocumentsPage({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const { state, reload } = useSpecPage(hubId, "documents");
  const { note, report, clear } = useOutcomeNote(reload);
  const [uploading, setUploading] = useState(false);

  if (uploading) {
    const sent = (result: Outcome) => {
      report(result);
      setUploading(false);
    };
    return (
      <>
        <TitleRow title={t("documents.upload")} />
        <div className="content">
          <UploadForm hubId={hubId} onOutcome={sent} onCancel={() => setUploading(false)} />
        </div>
      </>
    );
  }

  if (state.kind === "loading") return <TitleRow title={t("menu.documents")} />;

  const open = () => {
    clear();
    setUploading(true);
  };
  return <DocumentsList rows={state.kind === "ready" ? state.rows : null} note={note} onUpload={open} />;
}
