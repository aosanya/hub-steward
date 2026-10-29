import { useConsole } from "../../shell/context";
import { WorkflowsPage } from "../workflows/WorkflowsPage";

export function WorkflowsView() {
  const { hub } = useConsole();
  return <WorkflowsPage key={hub.id} hubId={hub.id} />;
}
