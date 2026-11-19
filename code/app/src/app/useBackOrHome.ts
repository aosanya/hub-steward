import { useLocation, useNavigate } from "react-router-dom";
import { openAgencyId } from "../shared/wakala/openAgency";
import { homeTab, tabPathIn } from "./tabs";

export function useBackOrHome(): () => void {
  const navigate = useNavigate();
  const { key } = useLocation();
  return () => (key === "default" ? navigate(tabPathIn(homeTab, openAgencyId()), { replace: true }) : navigate(-1));
}
