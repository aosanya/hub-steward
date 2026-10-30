import { useConsole } from "../../shell/context";
import { PublishPage } from "../publish/PublishPage";

export function PublishView() {
  const { hub } = useConsole();
  return <PublishPage key={hub.id} hubId={hub.id} />;
}
