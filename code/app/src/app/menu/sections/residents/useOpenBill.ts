import { useLocation, useNavigate } from "react-router-dom";
import { financePaths } from "../finance/paths";

export function useOpenBill(personId: string, backTitle: string) {
  const navigate = useNavigate();
  const here = useLocation();
  return (billId: string) => {
    const back = new URLSearchParams(here.search);
    back.set("person", personId);
    navigate(financePaths.revenueAndBilling.path({ bill: billId }), { state: { from: { path: `${here.pathname}?${back.toString()}`, title: backTitle } } });
  };
}
