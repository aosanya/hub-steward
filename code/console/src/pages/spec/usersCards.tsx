import { useState, type ReactNode } from "react";
import { useI18n } from "../../i18n";
import { Card, Detail, Empty, Stack, TextLink } from "../../ui";
import { Dash, shortDate } from "./usersParts";
import type { UserLine } from "./usersRead";
import { GroupChips, RoleChips, userPath } from "./usersTable";

type UserCardProps = { hubId: string; line: UserLine };

function UserCard({ hubId, line }: UserCardProps) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const pairs: [string, ReactNode][] = [
    [t("users.colRole"), <RoleChips hubId={hubId} roles={line.roles} withGroup />],
    [t("users.colGroups"), <GroupChips groups={line.groups} />],
    [t("users.colJoined"), line.joined ? shortDate(line.joined, lang) : <Dash />],
    ...(line.code ? [[t("field.actor_code"), <span className="count">{line.code}</span>] as [string, ReactNode]] : []),
  ];
  return (
    <Card
      title={line.name}
      open={open}
      onToggle={() => setOpen(!open)}
      actions={
        <TextLink to={userPath(hubId, line.id)} size="sm">
          {t("openHub")}
        </TextLink>
      }
    >
      <Detail pairs={pairs} />
    </Card>
  );
}

export function UsersCards({ hubId, lines }: { hubId: string; lines: UserLine[] }) {
  const { t } = useI18n();
  if (lines.length === 0) return <Empty text={t("noRows")} />;
  return (
    <Stack gap={20}>
      {lines.map((line) => (
        <UserCard key={line.id} hubId={hubId} line={line} />
      ))}
    </Stack>
  );
}
