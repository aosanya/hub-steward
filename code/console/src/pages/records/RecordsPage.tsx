import { useSearchParams } from "react-router-dom";
import { hubPath } from "../../api";
import { listRecords } from "../../data/pages/records";
import { useI18n } from "../../i18n";
import { useLoaded } from "../../shell/useLoaded";
import { DataTable, Empty, TextLink, PageHeader } from "../../ui";
import { RecordRows } from "./RecordRows";

const recordPath = (hubId: string, code: string) => hubPath(hubId, "records") + "?record=" + encodeURIComponent(code);

export function RecordsPage({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const code = params.get("record") ?? "";
  const { state } = useLoaded(() => listRecords(hubId), [hubId]);

  if (state.kind === "loading") return <PageHeader title={t("menu.records")} />;

  const open = state.kind === "ready" ? state.value.find((record) => record.code === code) : undefined;
  if (open) return <RecordRows key={open.code} hubId={hubId} record={open} />;

  return (
    <>
      <PageHeader title={t("menu.records")} />
      <div className="content">
        {state.kind === "failed" ? (
          <Empty text={t("loadFailed")} failed />
        ) : code ? (
          <Empty text={t("noRows")} />
        ) : (
          <DataTable
            columns={[t("name"), t("ui.form"), ""]}
            rows={state.value.map((record) => ({
              key: record.code,
              cells: [record.name, record.formName, <TextLink to={recordPath(hubId, record.code)}>{t("ui.open")}</TextLink>],
            }))}
            empty={t("noRows")}
          />
        )}
      </div>
    </>
  );
}
