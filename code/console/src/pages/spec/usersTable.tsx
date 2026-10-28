import { Fragment } from "react";
import { Link } from "react-router-dom";
import { hubPath } from "../../api";
import { useI18n } from "../../i18n";
import { Avatar, Cell, Chip, DataTable, TextLink } from "../../ui";
import { Dash, shortDate } from "./usersParts";
import type { SeatRole, UserLine } from "./usersRead";

type UsersTableProps = { hubId: string; lines: UserLine[]; asMembers?: boolean };

export const userPath = (hubId: string, id: string) => hubPath(hubId, "users") + "?open=" + encodeURIComponent(id);

export const seatText = (seat: SeatRole, withGroup: boolean) => (withGroup && seat.group ? seat.group + " · " + seat.role : seat.role);

export function RoleChips({ hubId, roles, withGroup }: { hubId: string; roles: SeatRole[]; withGroup: boolean }) {
  if (roles.length === 0) return <Dash />;
  return (
    <>
      {roles.map((seat, index) => (
        <Fragment key={seat.group + "|" + seat.role}>
          {index > 0 ? " " : null}
          <Link to={hubPath(hubId, "roles")}>
            <Chip kind="mute">{seatText(seat, withGroup)}</Chip>
          </Link>
        </Fragment>
      ))}
    </>
  );
}

export function GroupChips({ groups }: { groups: string[] }) {
  if (groups.length === 0) return <Dash />;
  return (
    <>
      {groups.map((group, index) => (
        <Fragment key={group}>
          {index > 0 ? " " : null}
          <Chip>{group}</Chip>
        </Fragment>
      ))}
    </>
  );
}

export function UsersTable({ hubId, lines, asMembers }: UsersTableProps) {
  const { t, lang } = useI18n();
  const severalGroups = !asMembers && new Set(lines.flatMap((line) => line.groups)).size > 1;
  const columns = [
    t(asMembers ? "groups.colMember" : "users.colUser"),
    ...(severalGroups ? [t("users.colGroups")] : []),
    t("users.colRole"),
    t("users.colJoined"),
  ];

  const rows = lines.map((line) => ({
    key: line.id,
    cells: [
      <Cell text={line.name} lead={<Avatar name={line.name} />} to={userPath(hubId, line.id)} />,
      ...(severalGroups ? [<GroupChips groups={line.groups} />] : []),
      <RoleChips hubId={hubId} roles={line.roles} withGroup={severalGroups || Boolean(asMembers)} />,
      shortDate(line.joined, lang),
    ],
    actions: (
      <TextLink to={userPath(hubId, line.id)} arrow size="sm">
        {t("openHub")}
      </TextLink>
    ),
  }));

  return <DataTable columns={columns} rows={rows} empty={t("noRows")} />;
}
