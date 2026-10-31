import { useConsole } from "../../shell/context";
import { ControlsPage } from "../controls/ControlsPage";

export function ControlsView() {
  const { hub } = useConsole();
  return <ControlsPage key={hub.id} hubId={hub.id} />;
}
