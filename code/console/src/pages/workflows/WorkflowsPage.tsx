import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { hubPath } from "../../api";
import { byName, matching } from "../../data/listView";
import { objectiveChoices } from "../../data/pages/workflows";
import type { ActionResult } from "../../data/types";
import { useI18n } from "../../i18n";
import { ButtonLink, Empty, FilterBar, Stack, TitleRow } from "../../ui";
import { rowsOf } from "../spec/usersLoad";
import { useLoaded } from "../../shell/useLoaded";
import { PendingNote } from "../spec/usersParts";
import { textOf } from "../spec/usersRead";
import { WorkflowCards } from "./WorkflowCards";
import { WorkflowDetail } from "./WorkflowDetail";

export const editPath = (hubId: string, id: string, search = "") => hubPath(hubId, "workflow-edit", id, "workflow") + search;

const listedWorkflows = (rows: Record<string, unknown>[], search: string) => {
  const own = rows.filter((row) => row.default !== true);
  const builtIn = rows.filter((row) => row.default === true);
  const nameOf = (row: Record<string, unknown>) => textOf(row.name);
  return [...byName(matching(own, (row) => [nameOf(row), textOf(row.code), textOf(row.description)], search), nameOf), ...matching(builtIn, (row) => [nameOf(row), textOf(row.code)], search)];
};

export function WorkflowsPage({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const openId = params.get("open");
  const { state, reload } = useLoaded(async () => {
    const [rows, choices] = await Promise.all([
      rowsOf("workflows", hubId, openId ? { workflow: openId } : {}),
      objectiveChoices(hubId).catch(() => null),
    ]);
    return { rows, choices, codes: choices && Object.fromEntries(choices.map((choice) => [choice.id, { code: choice.code, title: choice.title }])) };
  }, [hubId, openId]);
  const [waiting, setWaiting] = useState(false);
  const [search, setSearch] = useState("");
  const changed = (result: ActionResult) => {
    setWaiting(result === "accepted");
    reload();
  };

  if (state.kind === "loading") return <TitleRow title={t("menu.workflows")} />;

  if (openId) {
    const detail = state.kind === "ready" ? state.value.rows[0] : undefined;
    const workflow = detail?.workflow as Record<string, unknown> | null | undefined;
    return (
      <>
        <TitleRow title={workflow ? textOf(workflow.name) : t("menu.workflows")} primary={workflow ? t("workflows.editLink") : undefined} primaryTo={editPath(hubId, openId)} />
        <div className="content">
          <Stack gap={20}>
            {waiting ? <PendingNote /> : null}
            {detail && workflow ? <WorkflowDetail hubId={hubId} workflowId={openId} detail={detail} choices={state.kind === "ready" ? state.value.choices : null} onChanged={changed} /> : <Empty text={t(state.kind === "ready" ? "noRows" : "loadFailed")} failed={state.kind === "failed"} />}
          </Stack>
        </div>
      </>
    );
  }

  const listed = state.kind === "ready" ? listedWorkflows(state.value.rows, search) : [];

  return (
    <>
      <TitleRow title={t("menu.workflows")} primary={t("workflows.add")} primaryTo={editPath(hubId, "new")}>
        <ButtonLink kind="quiet" to={editPath(hubId, "new", "?cancel=1")}>
          {t("workflows.addCancel")}
        </ButtonLink>
      </TitleRow>
      <div className="content">
        <Stack gap={20}>
          {state.kind === "failed" ? (
            <Empty text={t("loadFailed")} failed />
          ) : (
            <>
              <FilterBar placeholder={t("workflows.search")} chips={[]} search={search} onSearch={setSearch} />
              <WorkflowCards hubId={hubId} rows={listed} codes={state.value.codes} reload={reload} />
            </>
          )}
          <p className="muted">{t("publish.reach")}</p>
        </Stack>
      </div>
    </>
  );
}
