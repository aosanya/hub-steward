import { heatOf, kindColors, kindSlices, tokensOf, type Usage, type UsageRow } from "../../data/usageBreakdown";
import { useI18n } from "../../i18n";
import { Card, DonutChart, Heatmap, Stack, shortTokens } from "../../ui";
import { rangeLabel } from "./usageFormat";

type Props = { usage: Usage; rows: UsageRow[] };

export function UsageWork({ usage, rows }: Props) {
  const { t, lang } = useI18n();
  const range = rangeLabel(usage, lang);
  const heat = heatOf(rows);
  return (
    <Stack gap={20}>
      <Card title={t("usage.byKind")}>
        <DonutChart
          slices={kindSlices(rows).map((slice) => ({ name: t(`usage.kind.${slice.kind}`), color: kindColors[slice.kind], value: slice.value }))}
          center={shortTokens(tokensOf(rows))}
          sub={t("usage.tokensWord")}
          title={t("usage.chartKind").replace("{range}", range)}
        />
      </Card>
      <Card title={t("usage.heat")}>
        <Heatmap
          rowNames={heat.models}
          columns={heat.kinds.map((kind) => ({ name: t(`usage.kind.${kind}`), color: kindColors[kind] }))}
          matrix={heat.matrix}
          title={t("usage.chartHeat").replace("{range}", range)}
        />
      </Card>
    </Stack>
  );
}
