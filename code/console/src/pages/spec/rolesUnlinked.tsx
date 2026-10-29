import { useI18n } from "../../i18n";
import type { RoleAgent } from "../../data/pages/roles";
import { Card, Chip, Row, TextLink } from "../../ui";
import { agentEditPath } from "./rolesTable";

type UnlinkedAgentsProps = { hubId: string; agents: RoleAgent[] };

export function UnlinkedAgents({ hubId, agents }: UnlinkedAgentsProps) {
  const { t } = useI18n();
  if (agents.length === 0) return null;
  return (
    <Card title={t("roles.unlinkedTitle")}>
      {agents.map((agent) => (
        <Row key={agent.id} gap={8}>
          <TextLink to={agentEditPath(hubId, agent.id)} arrow size="sm">
            {agent.name}
          </TextLink>
          <Chip kind="warn">{t("roles.notLinked")}</Chip>
        </Row>
      ))}
    </Card>
  );
}
