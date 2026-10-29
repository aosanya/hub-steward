import { useI18n } from "../../i18n";
import {
  ButtonLink,
  Card,
  DataTable,
  Detail,
  SectionTitle,
  Stack,
  TextLink,
} from "../../ui";
import type { RunLine, Scenario } from "../../data/scenario";
import { formatWhen } from "../work/formatWhen";
import { ResultChip } from "./ResultChip";
import { testPath } from "./paths";

export type Tab = "scenario" | "actors" | "blocks";

export const tabOf = (value: string | null): Tab =>
  value === "actors" || value === "blocks" ? value : "scenario";

type Props = { hubId: string; scenario: Scenario; runs: RunLine[] };

function ScenarioTab({ hubId, scenario, runs }: Props) {
  const { t, lang } = useI18n();
  const last = scenario.last;
  const dash = "—";
  return (
    <Stack gap={24}>
      <Card
        title={t("test.tabScenario")}
        actions={
          <ButtonLink
            kind="quiet"
            size="sm"
            to={testPath(hubId, { edit: scenario.id })}
          >
            {t("test.edit")}
          </ButtonLink>
        }
      >
        <Detail
          pairs={[
            [t("field.summary"), scenario.summary || dash],
            [t("field.workflow_id"), scenario.workflow || dash],
            [
              t("test.ruleShown"),
              scenario.rules.length > 0 ? scenario.rules.join(", ") : dash,
            ],
            [
              t("test.lastRunLabel"),
              last ? formatWhen(last.startedAt, lang) : dash,
            ],
            [
              t("test.result"),
              <ResultChip key="result" result={scenario.result} />,
            ],
            [
              t("test.tokensLabel"),
              last ? last.tokens.toLocaleString(lang) : dash,
            ],
          ]}
        />
      </Card>
      <Stack gap={10}>
        <SectionTitle title={t("test.runs")} />
        <DataTable
          columns={[
            t("test.colWhen"),
            t("test.colResult"),
            t("test.colTokens"),
          ]}
          rows={runs.map((run) => ({
            key: run.id,
            cells: [
              formatWhen(run.startedAt, lang),
              <ResultChip key="r" result={run.result} />,
              run.tokens.toLocaleString(lang),
            ],
            actions: (
              <TextLink to={testPath(hubId, { run: run.id })} arrow size="sm">
                {t("ui.open")}
              </TextLink>
            ),
          }))}
          empty={t("test.noRuns")}
        />
      </Stack>
    </Stack>
  );
}

export function ScenarioDetail({ hubId, scenario, runs }: Props) {
  return <ScenarioTab hubId={hubId} scenario={scenario} runs={runs} />;
}
