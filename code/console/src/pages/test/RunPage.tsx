import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { runOne } from "../../data/scenario";
import { budgetStopped } from "../../data/testBudget";
import {
  isActive,
  refusalOf,
  stopRun,
  type RunPage as RunData,
} from "../../data/testRun";
import { useI18n } from "../../i18n";
import {
  Button,
  Card,
  DataTable,
  Detail,
  Empty,
  Note,
  Row,
  SectionTitle,
  Stack,
  TextLink,
  TitleRow,
} from "../../ui";
import { formatWhen } from "../work/formatWhen";
import { ResultChip } from "./ResultChip";
import { DataTrail } from "./DataTrail";
import { RaiseTokens } from "./RaiseTokens";
import { RunSteps } from "./RunSteps";
import { WhyAnswer } from "./WhyAnswer";
import { reportPath, testPath } from "./paths";
import { useTestRun } from "./useTestRun";

type Props = { hubId: string; runId: string };

function RunBody({
  hubId,
  data,
  reload,
}: {
  hubId: string;
  data: RunData;
  reload: () => void;
}) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState("");
  const [tab, setTab] = useState<"steps" | "trail">("steps");
  const [why, setWhy] = useState<number | null>(null);
  const [raising, setRaising] = useState(false);
  const [raised, setRaised] = useState<number | null>(null);
  const { run, runs, scenarioName, workflowId } = data;
  const dash = "—";

  const stop = () => {
    setBusy(true);
    stopRun(hubId, run.id)
      .catch((error) => setRefusal(refusalOf(error) || t("test.stopFailed")))
      .finally(() => {
        setBusy(false);
        reload();
      });
  };

  const runAgain = () => {
    setBusy(true);
    setRefusal("");
    runOne(hubId, run.scenarioId)
      .then((id) =>
        id === "" ? reload() : navigate(testPath(hubId, { run: id })),
      )
      .catch((error) => setRefusal(refusalOf(error) || t("test.runNotStarted")))
      .finally(() => setBusy(false));
  };

  const title = scenarioName || t("test.runTitle");

  if (why !== null)
    return (
      <>
        <TitleRow title={title} />
        <div className="content">
          <WhyAnswer
            hubId={hubId}
            run={run}
            index={why}
            workflowId={workflowId}
            onClear={() => setWhy(null)}
          />
        </div>
      </>
    );

  if (raising)
    return (
      <>
        <TitleRow title={title} />
        <div className="content">
          <RaiseTokens
            hubId={hubId}
            budget={run.tokenBudget}
            onRaised={(value) => {
              setRaised(value);
              setRaising(false);
            }}
            onClear={() => setRaising(false)}
          />
        </div>
      </>
    );

  return (
    <>
      <TitleRow
        title={title}
        primary={t(isActive(run.result) ? "test.stop" : "test.print")}
        onPrimary={busy ? undefined : stop}
        primaryTo={
          isActive(run.result) ? undefined : reportPath(hubId, run.id)
        }
      />
      <div className="content">
        <Stack gap={24}>
          <TextLink to={testPath(hubId, { open: run.scenarioId })}>
            {t("back")}
          </TextLink>
          {refusal ? (
            <Empty failed text={refusal} />
          ) : null}
          <Card title={t("test.tabScenario")}>
            <Detail
              pairs={[
                [
                  t("test.colWhen"),
                  run.startedAt ? formatWhen(run.startedAt, lang) : dash,
                ],
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
                        .replace("{n}", run.tokens.toLocaleString(lang))
                        .replace("{budget}", run.tokenBudget.toLocaleString(lang))
                    : run.tokens.toLocaleString(lang),
                ],
                [t("test.onDraft"), run.draftVersion || dash],
              ]}
            />
          </Card>
          {raised !== null ? (
            <Note>
              {t("test.tokensRaised").replace("{n}", raised.toLocaleString(lang))}
            </Note>
          ) : null}
          {budgetStopped(run) ? (
            <Row gap={8}>
              <Button size="sm" disabled={busy} onClick={runAgain}>
                {t("test.runScenarioAgain")}
              </Button>
              <Button kind="quiet" size="sm" onClick={() => setRaising(true)}>
                {t("test.raiseTokens")}
              </Button>
            </Row>
          ) : null}
          <nav className="tabs">
            {(["steps", "trail"] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                className="tab"
                aria-current={tab === entry ? "page" : undefined}
                onClick={() => setTab(entry)}
              >
                {t(entry === "steps" ? "test.transpired" : "test.dataTrail")}
              </button>
            ))}
          </nav>
          {tab === "steps" ? (
            <RunSteps
              hubId={hubId}
              steps={run.steps}
              busy={busy}
              onRunAgain={runAgain}
              onWhy={setWhy}
            />
          ) : (
            <DataTrail run={run} />
          )}
          <Stack gap={10}>
            <SectionTitle title={t("test.runs")} />
            <DataTable
              columns={[
                t("test.colWhen"),
                t("test.colDraft"),
                t("test.colResult"),
                t("test.colTokens"),
              ]}
              rows={runs.map((entry) => ({
                key: entry.id,
                cells: [
                  formatWhen(entry.startedAt, lang),
                  entry.draftVersion || dash,
                  <ResultChip key="result" result={entry.result} />,
                  entry.tokens.toLocaleString(lang),
                ],
                actions:
                  entry.id === run.id ? undefined : (
                    <TextLink
                      to={testPath(hubId, { run: entry.id })}
                      arrow
                      size="sm"
                    >
                      {t("ui.open")}
                    </TextLink>
                  ),
              }))}
              empty={t("test.noRuns")}
            />
          </Stack>
        </Stack>
      </div>
    </>
  );
}

export function RunPage({ hubId, runId }: Props) {
  const { t } = useI18n();
  const { state, reload } = useTestRun(hubId, runId);
  if (state.kind === "ready")
    return <RunBody hubId={hubId} data={state.value} reload={reload} />;
  return (
    <>
      <TitleRow title={t("test.runTitle")} />
      <div className="content">
        {state.kind === "failed" ? (
          <Empty text={t("loadFailed")} failed />
        ) : null}
      </div>
    </>
  );
}
