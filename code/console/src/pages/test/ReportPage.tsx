import { Navigate } from "react-router-dom";
import { isActive, loadRunReport, type RunReport } from "../../data/testRun";
import { useI18n } from "../../i18n";
import { Card, Detail, Empty, Stack, TextLink, TitleRow } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { ResultChip } from "./ResultChip";
import {
  ReportBlocks,
  ReportRules,
  ReportSection,
  ReportSteps,
  ReportStored,
} from "./ReportTables";
import { testPath } from "./paths";
import { reportWhen } from "./reportWhen";
import "./report.css";

type Props = { hubId: string; runId: string };

function ReportBody({ hubId, report }: { hubId: string; report: RunReport }) {
  const { t, lang } = useI18n();
  const { run, scenario, agency, rules } = report;
  const dash = "—";
  const blocks = scenario?.blocks ?? [];
  const tokens = run.tokens.toLocaleString(lang);
  return (
    <>
      <TitleRow
        title={t("test.reportTitle")}
        primary={t("test.printNow")}
        onPrimary={() => window.print()}
      />
      <div className="content report">
        <Stack gap={24}>
          <TextLink
            to={testPath(hubId, { run: run.id })}
            className="hide-in-print"
          >
            {t("back")}
          </TextLink>
          <Card title={t("test.reportTitle")}>
            <Detail
              pairs={[
                [t("test.agency"), agency || dash],
                [t("test.tabScenario"), scenario?.name || dash],
                [t("test.runTitle"), reportWhen(run.startedAt, lang) || dash],
                [t("test.colDraft"), run.draftLabel || run.draftVersion || dash],
                [
                  t("test.result"),
                  <span key="result">
                    <ResultChip result={run.result} />
                    {run.stopReason ? <> {run.stopReason}</> : null}
                  </span>,
                ],
                [
                  t("test.tokensLabel"),
                  run.tokenBudget > 0
                    ? t("test.tokensOf")
                        .replace("{n}", tokens)
                        .replace("{budget}", run.tokenBudget.toLocaleString(lang))
                    : tokens,
                ],
              ]}
            />
          </Card>
          <ReportSection title={t("test.tab.blocks")}>
            <ReportBlocks blocks={blocks} />
          </ReportSection>
          <ReportSection title={t("test.transpired")}>
            <ReportSteps steps={run.steps} blocks={blocks} />
          </ReportSection>
          <ReportSection title={t("test.stored")}>
            <ReportStored stored={run.stored} />
          </ReportSection>
          <ReportSection title={t("test.rulesHeld")}>
            <ReportRules rules={rules} />
          </ReportSection>
        </Stack>
      </div>
    </>
  );
}

export function ReportPage({ hubId, runId }: Props) {
  const { t } = useI18n();
  const { state } = useLoaded(() => loadRunReport(hubId, runId), [hubId, runId]);
  if (state.kind === "ready")
    return isActive(state.value.run.result) ? (
      <Navigate to={testPath(hubId, { run: runId })} replace />
    ) : (
      <ReportBody hubId={hubId} report={state.value} />
    );
  return (
    <>
      <TitleRow title={t("test.reportTitle")} />
      <div className="content">
        {state.kind === "failed" ? (
          <Empty text={t("loadFailed")} failed />
        ) : null}
      </div>
    </>
  );
}
