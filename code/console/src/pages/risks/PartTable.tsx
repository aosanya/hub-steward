import { useI18n } from "../../i18n";
import { Cell, DataTable, IconButton } from "../../ui";
import type { Part } from "../../data/pages/risks";

type PartTableProps = { first: string; parts: Part[]; onRemove: (part: Part) => void };

export function PartTable({ first, parts, onRemove }: PartTableProps) {
  const { t } = useI18n();
  return (
    <DataTable
      columns={[first, t("risks.controls")]}
      empty={t("noRows")}
      rows={parts.map((part) => ({
        key: part.linkId || part.id,
        cells: [<Cell key="title" text={part.title} sub={part.description || part.code} />, part.legacy ? "" : String(part.controls)],
        actions: (
          <IconButton icon={part.legacy ? "trash" : "cross"} label={part.legacy ? t("risks.delete") : t("risks.unlink")} danger={part.legacy} onClick={() => onRemove(part)} />
        ),
      }))}
    />
  );
}
