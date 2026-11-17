import { useConsole } from "../../shell/context";
import { RecordsPage } from "../records/RecordsPage";

export function RecordsView() {
  const { hub } = useConsole();
  return <RecordsPage key={hub.id} hubId={hub.id} />;
}
