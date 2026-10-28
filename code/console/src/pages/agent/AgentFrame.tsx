import { createContext, useContext, type ReactNode } from "react";
import { hubPath } from "../../api";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Stack, Tabs, TitleRow } from "../../ui";

export const tabs = [
  { id: "model", label: "agentTabModel" },
  { id: "limits", label: "agentTabLimits" },
  { id: "instructions", label: "agentTabInstructions" },
] as const;

export type TabId = (typeof tabs)[number]["id"];

export const tabOf = (value: string | undefined): TabId => tabs.find((tab) => tab.id === value)?.id ?? "model";

export type AgentFrameValue = { name: string; role: string; current: TabId };

const AgentFrameContext = createContext<AgentFrameValue | null>(null);

export const AgentFrameProvider = AgentFrameContext.Provider;

export const useAgentFrame = (): AgentFrameValue => {
  const frame = useContext(AgentFrameContext);
  if (!frame) throw new Error("useAgentFrame needs the agent page");
  return frame;
};

type PrimaryAction = { label: string; onClick: () => void };

export function AgentFrame({ primary, children }: { primary?: PrimaryAction; children?: ReactNode }) {
  const { hub } = useConsole();
  const { t } = useI18n();
  const { name, role, current } = useAgentFrame();

  return (
    <>
      <TitleRow title={name} primary={primary?.label} onPrimary={primary?.onClick} />
      <div className="content">
        <Stack gap={20}>
          <Tabs
            items={tabs.map((tab) => ({
              to: hubPath(hub.id, "agent-edit", role, tab.id),
              label: t(tab.label),
              current: tab.id === current,
            }))}
          />
          {children}
        </Stack>
      </div>
    </>
  );
}
