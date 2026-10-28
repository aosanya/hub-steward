import { measuresOn } from "../../data/features";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n";
import type { OptionItem } from "../../types";
import { TitleRow } from "../../ui";
import {
  FormCard,
  FormSelect,
  FormText,
  FormTextarea,
} from "../spec/goalsForm";
import { goalsHref, type Arrival } from "../spec/goalsLinks";
import { pickerOptions } from "../spec/pickerOptions";
import { sendObjective, workflowOptions } from "./objectiveAddWrite";
import { objectivesHref } from "./objectivesLinks";

type ObjectiveAddProps = {
  hubId: string;
  goalId?: string;
  origin?: "goals" | "objectives";
};

const landing = (
  hubId: string,
  origin: "goals" | "objectives",
  goalId: string,
) =>
  origin === "goals"
    ? goalsHref(hubId, goalId ? { goal: goalId } : {})
    : objectivesHref(hubId);

export function ObjectiveAdd({
  hubId,
  goalId = "",
  origin = "objectives",
}: ObjectiveAddProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<OptionItem[]>([]);
  const [chosen, setChosen] = useState(goalId);
  const [workflows, setWorkflows] = useState<OptionItem[]>([]);
  const [chosenWorkflow, setChosenWorkflow] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [measure, setMeasure] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    pickerOptions("goals", hubId).then((options) => {
      if (current) setGoals(options);
    });
    workflowOptions(hubId)
      .then((options) => current && setWorkflows(options))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [hubId]);

  const goal = goals.some((option) => option.value === chosen)
    ? chosen
    : (goals[0]?.value ?? "");
  const workflow = workflows.some((option) => option.value === chosenWorkflow)
    ? chosenWorkflow
    : (workflows[0]?.value ?? "");
  const back = landing(hubId, origin, goalId);

  const submit = async () => {
    const missing = [
      !goal ? t("field.goal_id") : "",
      !title.trim() ? t("field.name") : "",
      !workflow ? t("field.workflow_id") : "",
      measuresOn && measure.trim() && !target.trim()
        ? t("objectives.target")
        : "",
    ].filter(Boolean);
    if (missing.length > 0) {
      setError(`${t("required")}: ${missing.join(", ")}`);
      return;
    }
    setError("");
    setBusy(true);
    const result = await sendObjective(hubId, {
      goal_id: goal,
      title,
      description,
      measure,
      target,
      workflow_id: workflow,
      workflow_name:
        workflows.find((option) => option.value === workflow)?.label ?? "",
    });
    setBusy(false);
    if (result === "failed") {
      setError(t("submitFailed"));
      return;
    }
    navigate(landing(hubId, origin, goal), {
      state: { outcome: result } satisfies Arrival,
    });
  };

  return (
    <>
      <TitleRow title={t("addObjective")} />
      <div className="content">
        <FormCard
          title={t("goals.newObjective")}
          submit={t("save")}
          cancel={t("cancel")}
          note={t("goals.formNote")}
          error={error}
          busy={busy}
          onSubmit={submit}
          onCancel={() => navigate(back)}
        >
          <FormText
            label={t("field.name")}
            value={title}
            onChange={setTitle}
            placeholder={t("goals.nameHint")}
          />
          <FormSelect
            label={t("field.goal_id")}
            value={goal}
            options={goals}
            onChange={setChosen}
          />
          <FormTextarea
            label={t("field.description")}
            value={description}
            onChange={setDescription}
          />
          {measuresOn ? (
            <>
              <FormText
                label={t("objectives.measure")}
                value={measure}
                onChange={setMeasure}
                placeholder={t("objectives.measureHint")}
              />
              <FormText
                label={t("objectives.target")}
                value={target}
                onChange={setTarget}
                placeholder={t("objectives.targetHint")}
              />
            </>
          ) : null}
          <FormSelect
            label={t("field.workflow_id")}
            value={workflow}
            options={workflows}
            onChange={setChosenWorkflow}
          />
        </FormCard>
      </div>
    </>
  );
}
