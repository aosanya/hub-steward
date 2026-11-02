import type { ReactNode } from "react";
import { hubPath } from "../../api";
import { Avatar, Badge, Cell, Icon } from "../../ui";

type Props = { hubId: string; name: string; ai: boolean; sub?: ReactNode };

export function RoleCell({ hubId, name, ai, sub }: Props) {
  return (
    <Cell
      to={hubPath(hubId, "roles")}
      text={name}
      sub={sub}
      lead={
        ai ? (
          <Badge>
            <Icon name="robot" size={16} />
          </Badge>
        ) : (
          <Avatar name={name} />
        )
      }
    />
  );
}
