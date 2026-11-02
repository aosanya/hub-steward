import { listParamsOf } from "../data/chatActions";
import { useI18n } from "../i18n";
import { DataTable, Empty } from "../ui";
import type { ActionViewProps } from "./actionViews";

export function ActionList({ params }: ActionViewProps) {
  const { t } = useI18n();
  const list = listParamsOf(params);
  if (!list) return <Empty text={t("loadFailed")} failed />;
  const rows = list.rows.map((cells, index) => ({ key: String(index), cells }));
  return <DataTable columns={list.columns} rows={rows} empty={t("noRows")} />;
}
