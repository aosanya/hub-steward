import { useLocation, useNavigate } from "react-router-dom";

export const panelBackTitle = "Residents";

export function useOpenFromPanel() {
  const navigate = useNavigate();
  const here = useLocation();
  return (path: string) => navigate(path, { state: { from: { path: `${here.pathname}${here.search}`, title: panelBackTitle } } });
}
