import { busyPersonName, loadUsageAnswer, usageAskOf } from "../../data/usageAnswer";
import { useI18n } from "../../i18n";
import { useLoaded } from "../../shell/useLoaded";
import { Card, Cell, DataTable, Empty, RankedBars, SectionTitle, Stack, Stats, shortTokens } from "../../ui";
import { countIn, dayLabel } from "./usageFormat";

type UsageAnswerViewProps = { hubId: string; title: string; params: Record<string, unknown>; onDone: () => void };

export function UsageAnswerView({ hubId, params }: UsageAnswerViewProps) {
  const { t, lang } = useI18n();
  const ask = usageAskOf(params);
  const { state } = useLoaded(() => loadUsageAnswer(hubId, ask), [hubId, JSON.stringify(params)]);

  if (state.kind === "loading") return null;
  if (state.kind === "failed") return <Empty failed text={t("loadFailed")} />;

  const { answer, names } = state.value;
  if (answer.tokens === 0) return <Empty text={t("usage.noCalls")} />;

  const words = { byItself: t("usage.byItself"), unknownPerson: t("usage.unknownPerson") };
  const kind = answer.kind === "" ? t("usage.statTokens") : t(`usage.kind.${answer.kind}`);
  const span = t(`usageAnswer.span.${ask.span}`);
  const busiest = answer.busiest;

  return (
    <Stack gap={20}>
      <Stats
        items={[
          { label: kind, value: shortTokens(answer.tokens), sub: t("usageAnswer.share").replace("{share}", String(answer.share)).replace("{span}", span) },
          { label: t("usageAnswer.runs"), value: countIn(answer.runs, lang), sub: t(`usage.span.${ask.span}`) },
          ...(busiest ? [{ label: t("usageAnswer.busiestDay"), value: dayLabel(busiest.day, lang), sub: t("usageAnswer.tokensSub").replace("{count}", shortTokens(busiest.tokens)) }] : []),
        ]}
      />
      <Card title={t("usageAnswer.byAgent").replace("{kind}", kind)}>
        <RankedBars rows={answer.byRole.map((role) => ({ name: role.name, tokensIn: role.tokensIn, tokensOut: role.tokensOut, requests: role.requests }))} />
      </Card>
      <SectionTitle title={t("usageAnswer.busiestDays").replace("{count}", String(answer.busyDays.length))} />
      <DataTable
        columns={[t("usageAnswer.colDay"), t("usage.statTokens"), t("usageAnswer.colRuns"), t("usageAnswer.colRunBy")]}
        empty={t("usage.noCalls")}
        rows={answer.busyDays.map((day) => ({
          key: day.day,
          cells: [
            <Cell key="day" text={dayLabel(day.day, lang)} />,
            <span className="count" key="tokens">
              {countIn(day.tokens, lang)}
            </span>,
            <span className="count" key="runs">
              {countIn(day.runs, lang)}
            </span>,
            busyPersonName(day, names, words),
          ],
        }))}
      />
    </Stack>
  );
}
