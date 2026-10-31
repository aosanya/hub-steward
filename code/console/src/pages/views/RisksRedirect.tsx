import { Navigate } from "react-router-dom";
import { risksHref } from "../risks/risksLinks";
import { useConsole } from "../../shell/context";

export function RisksRedirect() {
  const { hub } = useConsole();
  return <Navigate to={risksHref(hub.id)} replace />;
}
