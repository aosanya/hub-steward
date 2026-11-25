import { useNavigate } from "react-router-dom";
import type { View } from "../board/ViewSwitch";
import { rulebookPath } from "./paths";
import type { RuleKind } from "./types";

const kindOfView: Partial<Record<View, RuleKind>> = { rules: "rule", decisions: "decision", questions: "question" };

export const viewOfKind: Record<RuleKind, "rules" | "decisions" | "questions"> = { rule: "rules", decision: "decisions", question: "questions" };

export const rulebookKindOf = (view: View): RuleKind | undefined => kindOfView[view];

export function useOpenRulebook() {
  const navigate = useNavigate();
  return (backlogId: string, view: View): boolean => {
    const kind = rulebookKindOf(view);
    if (kind) navigate(rulebookPath(backlogId, kind));
    return kind !== undefined;
  };
}
