import { daysOf, figuresOf, perDaySeries, type Usage, type UsageRow } from "../../data/usageBreakdown";
import { useI18n } from "../../i18n";
import { Card, Grid, Stack, Stat, StackedBars, shortTokens } from "../../ui";
import { countIn, dayLabel, rangeLabel } from "./usageFormat";

type Props = { usage: Usage; rows: UsageRow[] };

const labelStep = (days: number): number => (days > 14 ? 7 : days > 7 ? 2 : 1);

export function UsageOverview({ usage, rows }: Props) {
  const { t, lang } = useI18n();
  const figures = figuresOf(rows);
  const range = rangeLabel(usage, lang);
  const days = daysOf(usage);
  return (
    <Stack gap={20}>
      <Grid min={9} gap={12}>
        <Stat label={t("usage.statTokens")} value={shortTokens(figures.tokens)} sub={range} />
        <Stat label={t("usage.statRequests")} value={countIn(figures.requests, lang)} sub={range} />
        <Stat label={t("usage.statSplit")} value={`${figures.inputShare} / ${100 - figures.inputShare}`} sub={t("usage.statSplitSub")} />
        <Stat label={t("usage.statTopModel")} value={`${figures.topShare}%`} sub={figures.topModel} />
      </Grid>
      <Card title={t("usage.perDay")}>
        <StackedBars
          labels={days.map((day) => dayLabel(day, lang))}
          series={perDaySeries(rows, days)}
          title={t("usage.chartDay").replace("{range}", range)}
          yTitle={t("usage.perDayAxis")}
          labelEvery={labelStep(days.length)}
        />
      </Card>
    </Stack>
  );
}
