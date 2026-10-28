import { useConsole } from "../../shell/context";
import { GroupsPage } from "../spec/groupsPage";

export function GroupsView() {
  const { hub } = useConsole();
  return <GroupsPage key={hub.id} hubId={hub.id} />;
}
