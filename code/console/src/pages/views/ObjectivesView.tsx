import { useSearchParams } from "react-router-dom";
import { measuresOn } from "../../data/features";
import { useConsole } from "../../shell/context";
import { ChangesAnswer } from "../draft/ChangesAnswer";
import { ObjectiveAdd } from "../objectives/ObjectiveAdd";
import { ObjectiveMeasures } from "../objectives/ObjectiveMeasures";
import { ObjectivesList } from "../objectives/ObjectivesList";
import { StepPage } from "../objectives/StepPage";
import { ObjectivePage } from "../spec/goalsObjective";

export function ObjectivesView() {
  const { hub } = useConsole();
  return <ObjectivesRoute key={hub.id} hubId={hub.id} />;
}

function ObjectivesRoute({ hubId }: { hubId: string }) {
  const [params] = useSearchParams();
  const objective = params.get("objective") ?? "";
  const step = params.get("step") ?? "";

  if (params.has("changes")) return <ChangesAnswer hubId={hubId} />;
  if (params.get("add") === "objective") return <ObjectiveAdd hubId={hubId} />;
  if (step) return <StepPage key={step} hubId={hubId} stepId={step} />;
  if (objective)
    return (
      <>
        <ObjectivePage
          key={objective}
          hubId={hubId}
          objectiveId={objective}
          goalId=""
        />
        {measuresOn ? (
          <ObjectiveMeasures
            key={`${objective}-measures`}
            hubId={hubId}
            objectiveId={objective}
          />
        ) : null}
      </>
    );
  return <ObjectivesList hubId={hubId} />;
}
