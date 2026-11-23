import { loadGeneratedDetail, type GeneratedDetail as Detail, type GeneratedStep } from "../../data/pages/generatedWorkflows";
import { useI18n } from "../../i18n";
import { useLoaded } from "../../shell/useLoaded";
import { Card, Chip, Detail as Pairs, Empty, SectionTitle, Stack, TextLink, TitleRow } from "../../ui";
import { Dash } from "../spec/usersParts";
import { PageContent } from "../work/PageContent";
import { designedPath, recordPath } from "./GeneratedWorkflowsPage";

type Hub = { hubId: string };

const recordLabel = (name: string, code: string) => (name === code ? name : `${name} (${code})`);

function StepCard({ hubId, number, step }: Hub & { number: number; step: GeneratedStep }) {
  const { t } = useI18n();
  return (
    <Card title={`${number} · ${step.name}`}>
      <Pairs
        pairs={[
          [t("workflows.kindLabel"), t("workflows.kind." + step.kind)],
          [t("workflows.actor"), step.actor || <Dash />],
          [
            t("generated.rowRecord"),
            step.record ? (
              <TextLink to={recordPath(hubId, step.record.code)} size="sm">
                {recordLabel(step.record.name, step.record.code)}
              </TextLink>
            ) : (
              <Dash />
            ),
          ],
          [t("generated.rowAction"), <span key="action" className="count">{step.rowAction}</span>],
          [t("ui.form"), step.formName || <Dash />],
          [t("workflows.questions"), step.questions.join(", ") || <Dash />],
        ]}
      />
    </Card>
  );
}

function Body({ hubId, detail }: Hub & { detail: Detail }) {
  const { t } = useI18n();
  const { workflow, steps, usedBy } = detail;
  const record = workflow.record;
  return (
    <Stack gap={20}>
      <Card title={t("workflows.card")}>
        <Stack>
          <Pairs
            pairs={[
              [t("controls.code"), <span key="code" className="count">{workflow.code}</span>],
              [
                t("workflows.kindLabel"),
                <>
                  <Chip kind="ok">{t("generated.kind")}</Chip> <Chip kind="mute">{t("generated.readOnly")}</Chip>
                </>,
              ],
              [
                t("generated.from"),
                <TextLink key="from" to={recordPath(hubId, record.code)} size="sm">
                  {recordLabel(record.name, record.code)}
                </TextLink>,
              ],
              [t("workflows.action"), t("generated.does." + workflow.action).replace("{record}", record.name)],
              [t("generated.heldBy"), workflow.heldBy || <Dash />],
              [
                t("generated.usedBy"),
                usedBy.length === 0 ? (
                  <Dash />
                ) : (
                  <Stack gap={4}>
                    {usedBy.map((use) => (
                      <TextLink key={use.workflow.id + use.place} to={designedPath(hubId, use.workflow.id)} size="sm">
                        {t("generated.usedAt").replace("{name}", use.workflow.name).replace("{n}", String(use.place))}
                      </TextLink>
                    ))}
                  </Stack>
                ),
              ],
              [t("workflows.version"), t("generated.follows")],
            ]}
          />
          <p className="soft">{t("generated.changes").replace("{record}", record.name)}</p>
        </Stack>
      </Card>
      <SectionTitle title={t("workflows.steps")} />
      <Stack>
        {steps.map((step, index) => (
          <StepCard key={step.id} hubId={hubId} number={index + 1} step={step} />
        ))}
      </Stack>
    </Stack>
  );
}

export function GeneratedWorkflowDetail({ hubId, workflowId }: Hub & { workflowId: string }) {
  const { t } = useI18n();
  const { state } = useLoaded(() => loadGeneratedDetail(hubId, workflowId), [hubId, workflowId]);

  if (state.kind === "loading") return <TitleRow title={t("workflows.generatedTitle")} />;
  const detail = state.kind === "ready" ? state.value : null;

  return (
    <>
      <TitleRow title={detail ? detail.workflow.name : t("workflows.generatedTitle")} />
      <PageContent>
        {detail ? <Body hubId={hubId} detail={detail} /> : <Empty text={t(state.kind === "ready" ? "noRows" : "loadFailed")} failed={state.kind === "failed"} />}
      </PageContent>
    </>
  );
}
