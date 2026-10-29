import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { scenarioFillIn } from "../../data/chatFill";
import {
  loadRuleLines,
  loadScenario,
  loadScenarios,
} from "../../data/scenario";
import { useI18n } from "../../i18n";
import { Empty, Note, Stack, TextLink, TitleRow } from "../../ui";
import type { Outcome } from "../spec/sendAction";
import { useLoaded } from "../../shell/useLoaded";
import { PendingNote } from "../spec/usersParts";
import { EditScenarioForm } from "./EditScenarioForm";
import { ReportPage } from "./ReportPage";
import { RulesHeld } from "./RulesHeld";
import { RunPage } from "./RunPage";
import { ScenarioDetail, tabOf } from "./ScenarioDetail";
import { AddScenarioForm } from "./ScenarioForm";
import { TestList } from "./TestList";
import { testPath } from "./paths";
import "./test.css";

type Hub = { hubId: string };

function Back({ hubId }: Hub) {
  const { t } = useI18n();
  return <TextLink to={testPath(hubId)}>{t("back")}</TextLink>;
}

function ListPage({ hubId }: Hub) {
  const { t } = useI18n();
  const { state, reload } = useLoaded(() => loadScenarios(hubId), [hubId]);
  if (state.kind === "loading") return <TitleRow title={t("menu.test")} />;
  if (state.kind === "failed")
    return (
      <>
        <TitleRow title={t("menu.test")} />
        <div className="content">
          <Empty text={t("loadFailed")} failed />
        </div>
      </>
    );
  return <TestList hubId={hubId} scenarios={state.value} reload={reload} />;
}

function AddPage({ hubId }: Hub) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const fill = scenarioFillIn(useLocation().state);
  const backToList = () => navigate(testPath(hubId));
  return (
    <>
      <TitleRow title={t("test.add")} />
      <div className="content">
        <Stack gap={20}>
          <Back hubId={hubId} />
          <AddScenarioForm
            hubId={hubId}
            fill={fill}
            onOutcome={backToList}
            onCancel={backToList}
          />
        </Stack>
      </div>
    </>
  );
}

function OpenPage({
  hubId,
  id,
  edit,
  tab,
}: Hub & { id: string; edit: boolean; tab: ReturnType<typeof tabOf> }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [waiting, setWaiting] = useState(false);
  const [saves, setSaves] = useState(0);
  const [saved, setSaved] = useState(false);
  const [fresh, setFresh] = useState<Awaited<
    ReturnType<typeof loadScenario>
  > | null>(null);
  const { state } = useLoaded(() => loadScenario(hubId, id), [hubId, id]);
  const loaded = state.kind === "ready" ? state.value : null;
  const detail = fresh ?? loaded;
  if (state.kind === "loading") return <TitleRow title={t("menu.test")} />;
  const back = () => navigate(testPath(hubId, { open: id }));
  const done = (result: Outcome) => {
    if (result === "accepted") return setWaiting(true);
    loadScenario(hubId, id).then((value) => {
      setFresh(value);
      setSaves((n) => n + 1);
      setSaved(true);
    }, back);
  };
  return (
    <>
      <TitleRow title={detail ? detail.scenario.name : t("menu.test")} />
      <div className="content">
        <Stack gap={20}>
          <Back hubId={hubId} />
          {waiting ? <PendingNote /> : null}
          {saved && edit ? <Note>{t("test.saved")}</Note> : null}
          {detail === null ? (
            <Empty
              text={t(state.kind === "failed" ? "loadFailed" : "noRows")}
              failed={state.kind === "failed"}
            />
          ) : edit ? (
            <EditScenarioForm
              key={saves}
              hubId={hubId}
              scenario={detail.scenario}
              tab={tab}
              onOutcome={done}
              onCancel={back}
            />
          ) : (
            <ScenarioDetail
              hubId={hubId}
              scenario={detail.scenario}
              runs={detail.runs}
            />
          )}
        </Stack>
      </div>
    </>
  );
}

function RulesPage({ hubId }: Hub) {
  const { t } = useI18n();
  const { state } = useLoaded(() => loadRuleLines(hubId), [hubId]);
  return (
    <>
      <TitleRow title={t("menu.test")} />
      <div className="content">
        {state.kind === "ready" ? (
          <RulesHeld hubId={hubId} rules={state.value} />
        ) : (
          <Empty
            text={t(state.kind === "failed" ? "loadFailed" : "noRows")}
            failed={state.kind === "failed"}
          />
        )}
      </div>
    </>
  );
}

export function TestPage({ hubId }: Hub) {
  const [params] = useSearchParams();
  const open = params.get("open") ?? params.get("edit");
  const tab = tabOf(params.get("tab"));
  const editing = params.get("edit") !== null || tab !== "scenario";
  if (params.get("add")) return <AddPage hubId={hubId} />;
  if (open)
    return (
      <OpenPage
        key={open + (editing ? "e" : "")}
        hubId={hubId}
        id={open}
        edit={editing}
        tab={tab}
      />
    );
  if (params.get("rules")) return <RulesPage hubId={hubId} />;
  const run = params.get("run");
  if (run && params.get("report"))
    return <ReportPage key={run} hubId={hubId} runId={run} />;
  if (run) return <RunPage key={run} hubId={hubId} runId={run} />;
  return <ListPage hubId={hubId} />;
}
