import { useConsole } from "../../shell/context";
import { ModulesPage } from "../modules/ModulesPage";

export function ModulesView() {
  const { hub } = useConsole();
  return <ModulesPage key={hub.id} hubId={hub.id} />;
}
