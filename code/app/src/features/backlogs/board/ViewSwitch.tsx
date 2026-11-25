import { useSearchParams } from "react-router-dom";
import { Segmented } from "../../../shared/ui/Segmented";
import { viewWords } from "../rulebook/words";

export type View = "list" | "board" | "rules" | "decisions" | "questions";

const boardViews = [
  { id: "list", label: "List" },
  { id: "board", label: "Board" },
] as const;

const rulebookViews = [
  { id: "rules", label: viewWords.rules },
  { id: "decisions", label: viewWords.decisions },
  { id: "questions", label: viewWords.questions },
] as const;

const viewParam = "view";

export function useView(): [View, (next: View) => void] {
  const [search, setSearch] = useSearchParams();
  const current: View = search.get(viewParam) === "list" ? "list" : "board";
  const choose = (next: View) => {
    if (next !== "list" && next !== "board") return;
    const params = new URLSearchParams(search);
    if (next === "list") params.set(viewParam, next);
    else params.delete(viewParam);
    setSearch(params, { replace: true });
  };
  return [current, choose];
}

type Props = { current: View; onChange: (next: View) => void; mayReadRules?: boolean };

export function ViewSwitch({ current, onChange, mayReadRules = false }: Props) {
  const items = mayReadRules ? [...boardViews, ...rulebookViews] : [...boardViews];
  return <Segmented items={items} current={current} onChange={onChange} label="View" />;
}
