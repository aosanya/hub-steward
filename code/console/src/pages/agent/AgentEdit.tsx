import { useParams } from "react-router-dom";
import { agentRows, type AgentRows } from "../../data/agent";
import { useConsole } from "../../shell/context";
import "./agent.css";
import { AgentFrameProvider, tabOf, type TabId } from "./AgentFrame";
import { InstructionsTab } from "./InstructionsTab";
import { LimitsTab } from "./LimitsTab";
import { ModelTab } from "./ModelTab";
import { useLoaded } from "../../shell/useLoaded";

function AgentPage({ role, current }: { role: string; current: TabId }) {
  const { hub } = useConsole();
  const { state: agent } = useLoaded<AgentRows>(() => agentRows(hub.id, role), [hub.id, role]);
  const name = (agent.kind === "ready" && agent.value.rows?.[0]?.name) || role;

  return (
    <AgentFrameProvider value={{ name, role, current }}>
      {current === "limits" ? <LimitsTab role={role} /> : null}
      {current === "instructions" ? <InstructionsTab role={role} /> : null}
      {current === "model" ? <ModelTab role={role} agent={agent} /> : null}
    </AgentFrameProvider>
  );
}

export function AgentEdit() {
  const { hub } = useConsole();
  const params = useParams();
  const role = params.role ?? "";
  return <AgentPage key={hub.id + "/" + role} role={role} current={tabOf(params.tab)} />;
}
