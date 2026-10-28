import { useState } from "react";
import { Link } from "react-router-dom";
import { hubPath } from "../../api";
import { useI18n } from "../../i18n";
import { Card, Chip, Detail, Empty, Icon, Stack, TextLink } from "../../ui";
import { Dash } from "./usersParts";
import type { GroupLine } from "./usersRead";

export const groupPath = (hubId: string, id: string) => hubPath(hubId, "groups") + "?open=" + encodeURIComponent(id);

export function JoinChip({ mode }: { mode: string }) {
  const { t } = useI18n();
  if (mode === "open") return <Chip kind="use">{t("groups.joinOpen")}</Chip>;
  if (mode === "confirmed") return <Chip kind="warn">{t("groups.joinApproval")}</Chip>;
  return mode ? <Chip kind="mute">{mode}</Chip> : <Dash />;
}

export function AiRoleChip({ hubId, name }: { hubId: string; name: string }) {
  if (!name) return <Dash />;
  return (
    <Link to={hubPath(hubId, "agents")}>
      <Chip kind="mute">
        <Icon name="robot" size={12} />
        {name}
      </Chip>
    </Link>
  );
}

function GroupCard({ hubId, line }: { hubId: string; line: GroupLine }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Card
      title={line.name}
      open={open}
      onToggle={() => setOpen(!open)}
      actions={
        <TextLink to={groupPath(hubId, line.id)} size="sm">
          {t("edit")}
        </TextLink>
      }
    >
      <Detail
        pairs={[
          [t("groups.colMembers"), String(line.members)],
          [t("groups.colJoinMode"), <JoinChip mode={line.mode} />],
          [t("groups.colAiRole"), <AiRoleChip hubId={hubId} name={line.aiRole} />],
        ]}
      />
    </Card>
  );
}

export function GroupsCards({ hubId, lines }: { hubId: string; lines: GroupLine[] }) {
  const { t } = useI18n();
  if (lines.length === 0) return <Empty text={t("noRows")} />;
  return (
    <Stack gap={20}>
      {lines.map((line) => (
        <GroupCard key={line.id} hubId={hubId} line={line} />
      ))}
    </Stack>
  );
}
