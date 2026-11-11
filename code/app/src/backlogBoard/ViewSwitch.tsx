import { useSearchParams } from "react-router-dom";
import { Segmented } from "../ui/Segmented";

export type View = "list" | "board";

const views = [
  { id: "list", label: "List" },
  { id: "board", label: "Board" },
] as const;

const viewParam = "view";

export function useView(): [View, (next: View) => void] {
  const [search, setSearch] = useSearchParams();
  const current: View = search.get(viewParam) === "list" ? "list" : "board";
  const choose = (next: View) => {
    const params = new URLSearchParams(search);
    if (next === "list") params.set(viewParam, next);
    else params.delete(viewParam);
    setSearch(params, { replace: true });
  };
  return [current, choose];
}

export function ViewSwitch({ current, onChange }: { current: View; onChange: (next: View) => void }) {
  return <Segmented items={[...views]} current={current} onChange={onChange} label="View" />;
}
