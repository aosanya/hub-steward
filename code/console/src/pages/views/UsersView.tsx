import { useConsole } from "../../shell/context";
import { UsersPage } from "../spec/usersPage";

export function UsersView() {
  const { hub } = useConsole();
  return <UsersPage key={hub.id} hubId={hub.id} />;
}
