import { hubPath } from "../../api";
import { isStaff } from "../../data/seat";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Tabs } from "../../ui";

export const modelTabs = ["key", "limits", "users", "usage"] as const;

export type ModelTab = (typeof modelTabs)[number];

const labels: Record<ModelTab, string> = {
  key: "models.tabKey",
  limits: "models.tabLimits",
  users: "models.tabUsers",
  usage: "models.tabUsage",
};

export { isStaff };

export const tabsOf = (role: string): ModelTab[] => modelTabs.filter((tab) => !(isStaff(role) && tab === "key"));

export const tabIn = (role: string, value: string | undefined): ModelTab => {
  const shown = tabsOf(role);
  return shown.find((tab) => tab === value) ?? shown[0];
};

export function ModelTabs({ accountId, current }: { accountId: string; current: ModelTab }) {
  const { t } = useI18n();
  const { hub } = useConsole();
  return (
    <Tabs
      items={tabsOf(hub.role).map((tab) => ({
        to: hubPath(hub.id, "models", accountId, tab),
        label: t(labels[tab]),
        current: tab === current,
      }))}
    />
  );
}
