import { useState } from "react";
import { hubBacklogsOf, taskTools, type HubStep } from "../../../../features/backlogs/shared/api";
import { useMay } from "../../../../features/agency/useMay";
import { Button } from "../../../../shared/ui/Button";
import { ChoiceGroup } from "../../../../shared/ui/ChoiceRow";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { refusalWords } from "../../MenuEditForm";

type Item = Record<string, unknown>;

type Props = { order: Item; onMoved: () => void };

const moveTool = "taskmanager_task_move_to_step";

const movePermission = "task.edit";

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const stepsOf = async (backlogId: string): Promise<HubStep[]> => {
  const reply = await callTool("", taskTools.backlogs, {});
  return hubBacklogsOf(reply).find((backlog) => backlog.id === backlogId)?.steps ?? [];
};

export function WorkOrderStatus({ order, onMoved }: Props) {
  const may = useMay(movePermission);
  const [steps, setSteps] = useState<HubStep[] | null>(null);
  const [moving, setMoving] = useState(false);
  const [refused, setRefused] = useState("");
  if (!may) return null;
  const backlog = textOf(order.backlog);
  const current = textOf(order.step);
  const isCurrent = (step: HubStep) => step.id === current || step.name === current;
  const open = async () => {
    setRefused("");
    try {
      setSteps(await stepsOf(backlog));
    } catch {
      setRefused(actionFailedWords);
    }
  };
  const move = async (step: HubStep) => {
    setMoving(true);
    setRefused("");
    try {
      await callTool("", moveTool, { taskID: textOf(order.id), backlog, step: step.id });
      setSteps(null);
      onMoved();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setMoving(false);
    }
  };
  if (steps === null) {
    return (
      <>
        <Button kind="quiet" onClick={open}>Change state</Button>
        {refused ? <LoadFailed words={refused} /> : null}
      </>
    );
  }
  return (
    <>
      <ChoiceGroup label="Move to">
        {steps.map((step) => (
          <Button key={step.id} kind="quiet" aria-current={isCurrent(step) ? "true" : undefined} disabled={moving || isCurrent(step)} onClick={() => move(step)}>
            {isCurrent(step) ? `${step.name} (now)` : step.name}
          </Button>
        ))}
      </ChoiceGroup>
      {refused ? <LoadFailed words={refused} /> : null}
      <Button kind="quiet" disabled={moving} onClick={() => setSteps(null)}>Cancel</Button>
    </>
  );
}
