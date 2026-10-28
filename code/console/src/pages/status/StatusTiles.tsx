import { hubPath } from "../../api";
import { useI18n } from "../../i18n";
import type { PageRow } from "../../types";
import { Grid, Tile } from "../../ui";

const namedBySeat = ["coordinator", "agent"];

export function StatusTiles({ rows, hubId }: { rows: PageRow[]; hubId: string }) {
  const { t } = useI18n();
  const labelOf = (row: PageRow) => (namedBySeat.includes(String(row.tile)) && row.word === "ready" ? String(row.check) : t(`status.${row.tile}.label`));
  const valueOf = (row: PageRow) => (row.provider ? `${row.provider} · ${t("modelKeySet")}` : t(`status.${row.tile}.${row.word}`));

  return (
    <Grid min={16} gap={12}>
      {rows.map((row) => (
        <Tile
          key={String(row.tile)}
          label={labelOf(row)}
          value={valueOf(row)}
          state={row.done === true ? "ok" : "warn"}
          to={row.target === "models" ? hubPath(hubId, "models") : undefined}
        />
      ))}
    </Grid>
  );
}
