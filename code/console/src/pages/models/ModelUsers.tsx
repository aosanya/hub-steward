import { hubPath } from "../../api";
import { accountUsers, type AccountUser } from "../../data/accounts";
import type { ModelAccount } from "../../data/modelLimits";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Badge, ButtonLink, Cell, DataTable, Empty, Icon, TextLink, type TableRowData } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";

const agentModelTab = "model";

const userRow = (user: AccountUser, hubId: string, edit: string): TableRowData => {
  const to = hubPath(hubId, "agent-edit", user.id, agentModelTab);
  return {
    key: user.id,
    cells: [
      <Cell
        key="agent"
        text={user.name}
        lead={
          <Badge>
            <Icon name="robot" size={16} />
          </Badge>
        }
        sub={user.description}
        to={to}
      />,
    ],
    actions: (
      <TextLink to={to} arrow size="sm">
        {edit}
      </TextLink>
    ),
  };
};

export function ModelUsers({ account }: { account: ModelAccount }) {
  const { t } = useI18n();
  const { hub } = useConsole();
  const { state: users } = useLoaded(() => accountUsers(hub.id, account.id), [hub.id, account.id]);

  if (users.kind === "loading") return null;
  if (users.kind === "failed") return <Empty failed text={t("loadFailed")} />;

  return (
    <DataTable
      columns={[t("agents.colAgent")]}
      empty={t("models.users.none")}
      emptyAction={<ButtonLink to={hubPath(hub.id, "agents")}>{t("models.users.openAgents")}</ButtonLink>}
      rows={users.value.map((user) => userRow(user, hub.id, t("agentEdit")))}
    />
  );
}
