import { Navigate, useLocation } from "react-router-dom";
import { hubPath } from "../../api";
import { useConsole } from "../../shell/context";
import { UsagePage } from "./UsagePage";

export function UsageRedirect() {
  const { hub } = useConsole();
  const { search } = useLocation();
  return <Navigate to={{ pathname: hubPath(hub.id, "usage-overview"), search }} replace />;
}

export const UsageOverviewView = () => <UsagePage which="overview" />;

export const UsageWorkView = () => <UsagePage which="work" />;

export const UsageAgentsView = () => <UsagePage which="agents" />;
