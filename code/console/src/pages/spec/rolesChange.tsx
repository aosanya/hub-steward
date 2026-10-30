import { hubPath } from "../../api";
import type { UsingScenario } from "../../data/pages/roleChange";
import { useI18n } from "../../i18n";
import { Button, ButtonLink, Card, DataTable, Note, Row, Stack } from "../../ui";

type RemoveRoleAskProps = { name: string; busy: boolean; error: string; onConfirm: () => void; onCancel: () => void };

export function RemoveRoleAsk({ name, busy, error, onConfirm, onCancel }: RemoveRoleAskProps) {
  const { t } = useI18n();
  return (
    <Card tight>
      <span>{t("roles.removeAsk").replace("{name}", name)}</span>
      {error ? (
        <p className="field-error error" role="alert">
          {error}
        </p>
      ) : null}
      <Row>
        <Button kind="danger" size="sm" disabled={busy} onClick={onConfirm}>
          {t("roles.removeConfirm")}
        </Button>
        <Button kind="quiet" size="sm" disabled={busy} onClick={onCancel}>
          {t("cancel")}
        </Button>
      </Row>
    </Card>
  );
}

export const roleRefusedText = (t: (key: string) => string, name: string, count: number): string =>
  t("roles.refused").replaceAll("{name}", name).replace("{count}", String(count));

const scenarioPath = (hubId: string, id: string) => hubPath(hubId, "test") + "?open=" + encodeURIComponent(id) + "&tab=actors";

type RoleRefusalProps = { hubId: string; name: string; scenarios: UsingScenario[] };

export function RoleRefusal({ hubId, name, scenarios }: RoleRefusalProps) {
  const { t } = useI18n();
  const rows = scenarios.map((scenario, index) => ({
    key: scenario.id || String(index),
    cells: [
      scenario.name,
      t("roles.actorsTab"),
      scenario.id ? (
        <ButtonLink kind="quiet" size="xs" to={scenarioPath(hubId, scenario.id)}>
          {t("roles.openScenario")}
        </ButtonLink>
      ) : null,
    ],
  }));
  return (
    <Stack gap={20}>
      <div role="alert">
        <Note>{roleRefusedText(t, name, scenarios.length)}</Note>
      </div>
      <Card title={t("roles.usedBy").replace("{name}", name)}>
        <DataTable columns={[t("roles.colScenario"), t("roles.colUsedIn"), ""]} rows={rows} empty={t("noRows")} />
      </Card>
    </Stack>
  );
}
