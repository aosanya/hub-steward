import { useConsole } from "../../shell/context";
import { GeneratedWorkflowsPage } from "../workflows/GeneratedWorkflowsPage";

export function GeneratedWorkflowsView() {
  const { hub } = useConsole();
  return <GeneratedWorkflowsPage key={hub.id} hubId={hub.id} />;
}
