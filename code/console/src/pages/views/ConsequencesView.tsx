import { useConsole } from "../../shell/context";
import { LibraryPartPage } from "../library/LibraryPartPage";

export function ConsequencesView() {
  const { hub } = useConsole();
  return <LibraryPartPage key={hub.id} hubId={hub.id} kind="consequence" />;
}
