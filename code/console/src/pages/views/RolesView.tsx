import { useConsole } from "../../shell/context";
import { RolesPage } from "../spec/rolesPage";

export function RolesView() {
  const { hub } = useConsole();
  return <RolesPage key={hub.id} hubId={hub.id} />;
}
