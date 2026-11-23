import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { hubPath } from "../../api";
import { matching } from "../../data/listView";
import { loadGenerated, type GeneratedWorkflow } from "../../data/pages/generatedWorkflows";
import { useI18n } from "../../i18n";
import { useLoaded } from "../../shell/useLoaded";
import { Cell, Chip, DataTable, Empty, FilterBar, Row, SectionTitle, Stack, TextLink, TitleRow } from "../../ui";
import { PageContent } from "../work/PageContent";
import { GeneratedWorkflowDetail } from "./GeneratedWorkflowDetail";

export const generatedPath = (hubId: string, id: string) => hubPath(hubId, "workflows-generated") + "?open=" + encodeURIComponent(id);

export const recordPath = (hubId: string, code: string) => hubPath(hubId, "records") + "?record=" + encodeURIComponent(code);

export const designedPath = (hubId: string, id: string) => hubPath(hubId, "workflows") + "?open=" + encodeURIComponent(id);

export function State({ hubId, workflow }: { hubId: string; workflow: GeneratedWorkflow }) {
  const { t } = useI18n();
  const by = workflow.replacedBy;
  if (!by) return <Chip kind="mute">{t("generated.readOnly")}</Chip>;
  return (
    <Stack gap={4}>
      <Row gap={8}>
        <Chip kind="mute">{t("generated.readOnly")}</Chip>
        <Chip kind="warn">{t("generated.replaced")}</Chip>
      </Row>
      <span className="muted">
        {t("generated.replacedBy")} {by.id ? <TextLink to={designedPath(hubId, by.id)} size="sm">{by.name}</TextLink> : by.name}
      </span>
    </Stack>
  );
}

export function GeneratedList({ hubId, workflows }: { hubId: string; workflows: GeneratedWorkflow[] }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const listed = matching(workflows, (workflow) => [workflow.name, workflow.code, workflow.record.name, workflow.heldBy], search);
  return (
    <>
      <FilterBar placeholder={t("workflows.search")} chips={[]} search={search} onSearch={setSearch} />
      <section>
        <Stack gap={8}>
          <SectionTitle title={t("menu.workflows-generated")} right={<span className="count">{listed.length}</span>} />
          <p className="soft">{t("generated.note")}</p>
          <DataTable
            columns={[t("workflows.card"), t("test.colRecord"), t("workflows.action"), t("generated.heldBy"), t("colState")]}
            empty={t("generated.none")}
            rows={listed.map((workflow) => ({
              key: workflow.id,
              cells: [
                <Cell key="name" text={workflow.name} sub={workflow.code} to={generatedPath(hubId, workflow.id)} />,
                <TextLink key="record" to={recordPath(hubId, workflow.record.code)} size="sm">
                  {workflow.record.name}
                </TextLink>,
                <Chip key="action" kind="mute">
                  {t("generated.action." + workflow.action)}
                </Chip>,
                workflow.heldBy,
                <State key="state" hubId={hubId} workflow={workflow} />,
              ],
              actions: (
                <TextLink to={generatedPath(hubId, workflow.id)} size="sm">
                  {t("ui.open")}
                </TextLink>
              ),
            }))}
          />
        </Stack>
      </section>
    </>
  );
}

export function GeneratedWorkflowsPage({ hubId }: { hubId: string }) {
  const [params] = useSearchParams();
  const openId = params.get("open");
  return openId ? <GeneratedWorkflowDetail hubId={hubId} workflowId={openId} /> : <GeneratedListPage hubId={hubId} />;
}

function GeneratedListPage({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const { state } = useLoaded(() => loadGenerated(hubId), [hubId]);

  if (state.kind === "loading") return <TitleRow title={t("workflows.generatedTitle")} />;

  return (
    <>
      <TitleRow title={t("workflows.generatedTitle")} />
      <PageContent>
        <Stack gap={20}>{state.kind === "failed" ? <Empty text={t("loadFailed")} failed /> : <GeneratedList hubId={hubId} workflows={state.value.workflows} />}</Stack>
      </PageContent>
    </>
  );
}
