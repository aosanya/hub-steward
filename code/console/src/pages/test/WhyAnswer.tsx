import type { ReactNode } from "react";
import { hubPath } from "../../api";
import { loadWhy } from "../../data/testWhy";
import type { TestRun } from "../../data/testRun";
import { useI18n } from "../../i18n";
import { Detail, Empty, FromChat, Row, TextLink } from "../../ui";
import { workflowHref } from "../objectives/objectivesLinks";
import { useLoaded } from "../../shell/useLoaded";

type Props = { hubId: string; run: TestRun; index: number; workflowId: string; onClear: () => void };

export function WhyAnswer({ hubId, run, index, workflowId, onClear }: Props) {
  const { t } = useI18n();
  const { state } = useLoaded(() => loadWhy(hubId, run, index), [hubId, run.id, index]);
  const body = (): ReactNode => {
    if (state.kind === "loading") return null;
    if (state.kind === "failed" || state.value === null) return <Empty text={t("loadFailed")} failed />;
    const { answer, cause } = state.value;
    const pairs: [string, ReactNode][] = [
      [t("test.colStep"), `${answer.number} · ${answer.step}: ${answer.did}`],
      ...(answer.ruleCode ? ([[t("test.colRule"), `${answer.ruleCode}: ${answer.ruleText}`]] as [string, ReactNode][]) : []),
      [t("test.expected"), answer.expected],
      [t("test.found"), answer.found],
      ...(cause ? ([[t("test.likelyCause"), cause]] as [string, ReactNode][]) : []),
    ];
    return (
      <Detail
        title={t("test.whyTitle")}
        pairs={pairs}
        actions={
          <Row gap={8}>
            <TextLink to={hubPath(hubId, "roles")} arrow size="sm">
              {t("test.openRule")}
            </TextLink>
            {workflowId ? (
              <TextLink to={workflowHref(hubId, workflowId)} arrow size="sm">
                {t("test.openWorkflow")}
              </TextLink>
            ) : null}
          </Row>
        }
      />
    );
  };
  return (
    <FromChat prompt={t("test.why")} onClear={onClear}>
      {body()}
    </FromChat>
  );
}
