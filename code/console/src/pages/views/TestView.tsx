import { useConsole } from "../../shell/context";
import { TestPage } from "../test/TestPage";

export function TestView() {
  const { hub } = useConsole();
  return <TestPage key={hub.id} hubId={hub.id} />;
}
