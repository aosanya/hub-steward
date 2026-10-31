import { hubPath } from "../../api";
import {
  areaOrder,
  areaPageOf,
  type ReviewArea,
  type ReviewPage,
} from "../../data/reviewApi";
import { isActionable } from "../../data/actionable";
import type { HubKind } from "../../data/hubKind";
import { useI18n } from "../../i18n";
import { Grid, Tile } from "../../ui";
import type { TileState } from "../../ui/props";

type AreaCardsProps = { hubId: string; kind: HubKind; page: ReviewPage };

const openIn = (area: ReviewArea) =>
  area.findings.filter((finding) => isActionable(finding) && finding.status === "open").length;

export function AreaCards({ hubId, kind, page }: AreaCardsProps) {
  const { t } = useI18n();
  const areas = areaOrder(kind)
    .map(({ area }) => page.areas.find((row) => row.area === area))
    .filter((row): row is ReviewArea => row !== undefined);

  const value = (row: ReviewArea) => {
    if (row.status === "failed") return t("review.failedTab");
    if (row.status === "reading") return t("review.reading");
    return t("review.openCount").replace("{n}", String(openIn(row)));
  };

  const state = (row: ReviewArea): TileState => {
    if (row.status === "failed") return "bad";
    if (row.status === "reading") return "mute";
    return openIn(row) === 0 ? "ok" : "warn";
  };

  return (
    <Grid min={13}>
      {areas.map((row) => (
        <Tile
          key={row.area}
          label={t("menu." + areaPageOf(row.area))}
          value={value(row)}
          state={state(row)}
          to={hubPath(hubId, areaPageOf(row.area))}
        />
      ))}
    </Grid>
  );
}
