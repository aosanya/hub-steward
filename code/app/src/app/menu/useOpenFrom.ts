import { useLocation, useNavigate } from "react-router-dom";

export function useOpenFrom(title: string) {
  const navigate = useNavigate();
  const here = useLocation();
  return (path: string) => navigate(path, { state: { from: { path: `${here.pathname}${here.search}`, title } } });
}
