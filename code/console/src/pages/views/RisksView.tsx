import { useSearchParams } from "react-router-dom";
import { useConsole } from "../../shell/context";
import { RiskAdd } from "../risks/RiskAdd";
import { RisksLanding } from "../risks/RisksLanding";

export function RisksView() {
  const { hub } = useConsole();
  const [params] = useSearchParams();
  if (params.get("add") === "risk") return <RiskAdd key={hub.id} hubId={hub.id} />;
  return <RisksLanding key={hub.id} hubId={hub.id} />;
}
