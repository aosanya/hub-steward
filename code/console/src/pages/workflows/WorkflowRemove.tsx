import { useI18n } from "../../i18n";
import type { Scenario } from "../../data/scenario";
import { Button, Card, DataTable, Empty, Note, Row, SectionTitle, Stack, TextLink } from "../../ui";
import { testPath } from "../test/paths";
import { refusalText, type Refusal } from "./useWorkflowRemoval";

type AskProps = { name: string; busy: boolean; onConfirm: () => void; onCancel: () => void };

export function RemoveWorkflow({ name, busy, onConfirm, onCancel }: AskProps) {
  const { t } = useI18n();
  return (
    <Card tight>
      <span>{t("workflows.removeAsk").replace("{name}", name)}</span>
      <Row>
        <Button kind="danger" size="sm" disabled={busy} onClick={onConfirm}>
          {t("workflows.removeConfirm")}
        </Button>
        <Button kind="quiet" size="sm" disabled={busy} onClick={onCancel}>
          {t("cancel")}
        </Button>
      </Row>
    </Card>
  );
}

export function RemoveFailed({ name }: { name: string }) {
  const { t } = useI18n();
  return <Empty text={t("workflows.removeFailed").replace("{name}", name)} failed />;
}

const rowOf = (hubId: string, workflow: string, scenario: Scenario) => ({
  key: scenario.id,
  cells: [
    <TextLink key="name" to={testPath(hubId, { open: scenario.id })}>
      {scenario.name}
    </TextLink>,
    workflow,
  ],
});

export function MirroringScenarios({ hubId, refusal }: { hubId: string; refusal: Refusal }) {
  const { t } = useI18n();
  return (
    <Stack gap={12}>
      <Note>{refusalText(t, refusal)}</Note>
      <SectionTitle title={t("workflows.mirroredBy").replace("{name}", refusal.name)} />
      <DataTable columns={[t("test.tab.scenario"), t("workflows.mirrors")]} rows={refusal.scenarios.map((scenario) => rowOf(hubId, refusal.name, scenario))} empty={t("noRows")} />
    </Stack>
  );
}
