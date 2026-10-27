import { useState } from "react";
import { Link } from "react-router-dom";
import { hubPath } from "../api";
import { useI18n } from "../i18n";
import { useConsole } from "../shell/context";
import type { PageRow } from "../types";
import { Button, DataTable, Empty, StatusLine, TitleRow, type TableRowData } from "../ui";
import { actionForms, isActionFormId, secondaryFormsOf, type ActionFormId } from "./spec/actionForms";
import { ActionSlot } from "./spec/ActionSlot";
import { GroupJoinToggle } from "./spec/GroupJoinToggle";
import type { Outcome } from "./spec/sendAction";
import { useSpecPage } from "./spec/useSpecPage";

type Note = { text: string; failed: boolean };

const noNote: Note = { text: "", failed: false };

const cellText = (value: unknown) => (value === undefined || value === null ? "" : String(value));

export function SpecPage() {
  const { hub, page } = useConsole();
  return <SpecView key={`${hub.id}/${page}`} hubId={hub.id} page={page} room={hub.manager_room_id} />;
}

function SpecView({ hubId, page, room }: { hubId: string; page: string; room: string | undefined }) {
  const { t } = useI18n();
  const { state, reload } = useSpecPage(hubId, page, room);
  const [openForm, setOpenForm] = useState<ActionFormId | null>(null);
  const [note, setNote] = useState<Note>(noNote);

  const open = (id: ActionFormId) => {
    setNote(noNote);
    setOpenForm(id);
  };
  const noteOf = (result: Outcome): Note => {
    if (result === "accepted") return { text: t("waitingForApproval"), failed: false };
    if (result === "failed") return { text: t("submitFailed"), failed: true };
    return noNote;
  };
  const report = (result: Outcome) => {
    setNote(noteOf(result));
    if (result === "done") reload();
  };

  if (state.kind === "loading") return null;
  if (state.kind === "planned") {
    return (
      <>
        <TitleRow title={t("menu." + page)} />
        <Empty text={t("planned")} />
      </>
    );
  }

  const { spec, rows } = state;
  const primaryForm = isActionFormId(page) ? page : null;
  const formTitle = (id: ActionFormId) => {
    const key = actionForms[id].title;
    return key ? t(key) : spec.primary;
  };

  const secondaryButtons = secondaryFormsOf(page).map((secondary) => (
    <Button key={secondary.form} kind="quiet" onClick={() => open(secondary.form)}>
      {t(secondary.label)}
    </Button>
  ));
  const rowCells = (row: PageRow) => spec.columns.map((column) => cellText(row[column.key]));
  const rowActions = (row: PageRow) => (
    <>
      {page === "groups" ? <GroupJoinToggle row={row} hubId={hubId} onOutcome={report} /> : null}
      {row.edit ? <Link to={hubPath(hubId, row.edit, cellText(row.id), "model")}>{t("agentEdit")}</Link> : null}
    </>
  );
  const tableRows = (list: PageRow[]): TableRowData[] =>
    list.map((row, index) => ({ key: cellText(row.id) || String(index), cells: rowCells(row), actions: rowActions(row) }));

  return (
    <>
      <TitleRow
        title={spec.title}
        primary={primaryForm ? spec.primary : undefined}
        onPrimary={primaryForm ? () => open(primaryForm) : undefined}
      >
        {secondaryButtons.length > 0 ? secondaryButtons : null}
      </TitleRow>
      <StatusLine text={note.text} failed={note.failed} />
      {openForm ? (
        <ActionSlot
          key={openForm}
          formId={openForm}
          title={formTitle(openForm)}
          hubId={hubId}
          onOutcome={report}
          onClose={() => setOpenForm(null)}
        />
      ) : null}
      {rows === null ? (
        <Empty text={t("loadFailed")} failed />
      ) : (
        <DataTable columns={spec.columns.map((column) => column.label)} rows={tableRows(rows)} empty={t("noRows")} />
      )}
    </>
  );
}
