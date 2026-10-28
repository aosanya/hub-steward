import { useLocation, useSearchParams } from "react-router-dom";
import { useConsole } from "../../shell/context";
import { ChangesAnswer } from "../draft/ChangesAnswer";
import { ObjectiveAdd } from "../objectives/ObjectiveAdd";
import { AddGoalPage } from "../spec/goalsAdd";
import { GoalPage } from "../spec/goalsDetail";
import { GoalList } from "../spec/goalsList";
import { ObjectivePage } from "../spec/goalsObjective";

export function GoalsView() {
  const { hub } = useConsole();
  return <GoalsRoute key={hub.id} hubId={hub.id} />;
}

function GoalsRoute({ hubId }: { hubId: string }) {
  const [params] = useSearchParams();
  const { key } = useLocation();
  const goal = params.get("goal") ?? "";
  const objective = params.get("objective") ?? "";
  const add = params.get("add");

  if (params.has("changes")) return <ChangesAnswer hubId={hubId} />;
  if (add === "goal") return <AddGoalPage hubId={hubId} />;
  if (add === "objective") return <ObjectiveAdd key={goal} hubId={hubId} goalId={goal} origin="goals" />;
  if (objective) return <ObjectivePage key={objective} hubId={hubId} objectiveId={objective} goalId={goal} />;
  if (goal) return <GoalPage key={goal} hubId={hubId} goalId={goal} />;
  return <GoalList key={key} hubId={hubId} />;
}
