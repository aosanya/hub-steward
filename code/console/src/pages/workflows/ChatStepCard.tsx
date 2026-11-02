import { textOf } from "../../data/pages/groups";
import type { Choice, StepDraft } from "../../data/pages/workflowDesign";
import { useI18n } from "../../i18n";
import { Card, Chip } from "../../ui";

type Props = { number: number; step: StepDraft; roles: Choice[] };

export function ChatStepCard({ number, step, roles }: Props) {
  const { t } = useI18n();
  const actor = roles.find((role) => role.value === step.roleId)?.label;
  const action = textOf(step.loaded, "action") || t("workflows.chatAction");
  return (
    <Card title={`${number} · ${step.name}`} actions={<Chip>{t("workflows.kind.chat")}</Chip>}>
      <span className="muted">{actor ? `${actor} · ${action}` : action}</span>
    </Card>
  );
}
