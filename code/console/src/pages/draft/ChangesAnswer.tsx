import { useNavigate } from "react-router-dom";
import { hubPath } from "../../api";
import { useI18n } from "../../i18n";
import { useDraftState } from "../../shell/draftContext";
import { Cell, Chip, DataTable, FromChat, TextLink, TitleRow } from "../../ui";
import { PageContent } from "../work/PageContent";
import { formatWhen } from "../work/formatWhen";

export function ChangesAnswer({ hubId }: { hubId: string }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { changes, ready } = useDraftState();

  const rows = changes.map((change) => ({
    key: change.id,
    cells: [
      <Chip key="kind" kind="mute">
        {t(change.kindWord)}
      </Chip>,
      <Cell key="title" text={change.title} sub={change.summary === change.title ? undefined : change.summary} />,
      change.decidedBy,
      <span key="when" className="count">
        {formatWhen(change.at, lang)}
      </span>,
    ],
    actions: (
      <TextLink to={hubPath(hubId, change.page)} arrow size="sm">
        {t("draft.open")}
      </TextLink>
    ),
  }));

  return (
    <>
      <TitleRow title={t("menu.goals")} />
      <PageContent>
        <FromChat prompt={t("draft.ask")} onClear={() => navigate(hubPath(hubId, "goals"))}>
          {ready ? (
            <DataTable
              columns={[t("draft.colKind"), t("draft.colTitle"), t("draft.colApprovedBy"), t("draft.colWhen")]}
              rows={rows}
              empty={t("draft.nothingWaiting")}
            />
          ) : null}
        </FromChat>
      </PageContent>
    </>
  );
}
