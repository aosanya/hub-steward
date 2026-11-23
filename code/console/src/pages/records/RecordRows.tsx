import { useState } from "react";
import { listRows, type LiveRecord } from "../../data/pages/records";
import { useI18n } from "../../i18n";
import { useLoaded } from "../../shell/useLoaded";
import { DataTable, Empty, Stack, TitleRow } from "../../ui";
import { RecordRowForm } from "./RecordRowForm";
import { RecordWorkflows } from "./RecordWorkflows";

export function RecordRows({ hubId, record }: { hubId: string; record: LiveRecord }) {
  const { t } = useI18n();
  const { state, reload } = useLoaded(() => listRows(hubId, record.code), [hubId, record.code]);
  const [adding, setAdding] = useState(false);

  const added = () => {
    setAdding(false);
    reload();
  };

  return (
    <>
      <TitleRow title={record.name} primary={record.canAddRows ? t("records.add") : undefined} onPrimary={() => setAdding(true)} />
      <div className="content">
        <Stack>
          {adding ? <RecordRowForm hubId={hubId} record={record} onAdded={added} onCancel={() => setAdding(false)} /> : null}
          {state.kind === "failed" ? <Empty text={t("loadFailed")} failed /> : null}
          {state.kind === "ready" ? (
            <DataTable
              columns={record.questions.map((question) => question.prompt)}
              rows={state.value.map((row) => ({ key: row.id, cells: record.questions.map((question) => row.answers[question.prompt] ?? "") }))}
              empty={t("noRows")}
            />
          ) : null}
          <RecordWorkflows hubId={hubId} record={record} />
        </Stack>
      </div>
    </>
  );
}
