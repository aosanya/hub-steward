import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { hubPath } from "../../api";
import { useI18n } from "../../i18n";
import { Card, Chip, Detail, Empty, Icon, Row, Stack, TextLink } from "../../ui";
import type { RoleLine } from "./usersRead";

export const rolePath = (hubId: string, id: string) => hubPath(hubId, "roles") + "?open=" + encodeURIComponent(id);

export const agentEditPath = (hubId: string, agentId: string) => hubPath(hubId, "agent-edit", agentId, "model");

type RoleTypeProps = { hubId: string; ai: boolean; configure?: string };

export function RoleType({ hubId, ai, configure }: RoleTypeProps) {
  const { t } = useI18n();
  if (!ai) return <Chip kind="mute">{t("roles.typeHuman")}</Chip>;
  const target = configure ?? hubPath(hubId, "agents");
  return (
    <Row gap={4}>
      <Link to={target}>
        <Chip kind="warn">
          <Icon name="robot" size={12} />
          {t("roles.typeAi")}
        </Chip>
      </Link>
      <TextLink to={target} arrow size="sm">
        {t("roles.configure")}
      </TextLink>
    </Row>
  );
}

type RolesCardsProps = { hubId: string; lines: RoleLine[] };

function RoleCard({ hubId, line }: { hubId: string; line: RoleLine }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const pairs: [string, ReactNode][] = [];
  if (line.description) pairs.push([t("field.description"), line.description]);
  pairs.push([t("roles.colType"), <RoleType hubId={hubId} ai={line.ai} />]);
  return (
    <Card
      title={line.name}
      open={open}
      onToggle={() => setOpen(!open)}
      actions={
        <TextLink to={rolePath(hubId, line.id)} size="sm">
          {t("edit")}
        </TextLink>
      }
    >
      <Detail pairs={pairs} />
    </Card>
  );
}

export function RolesCards({ hubId, lines }: RolesCardsProps) {
  const { t } = useI18n();
  if (lines.length === 0) return <Empty text={t("noRows")} />;
  return (
    <Stack gap={20}>
      {lines.map((line) => (
        <RoleCard key={line.id} hubId={hubId} line={line} />
      ))}
    </Stack>
  );
}
