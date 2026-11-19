import { useState } from "react";
import { useLoad } from "../../../../features/forms/useLoad";
import { useMay } from "../../../../features/agency/useMay";
import { listAgents } from "../../../../features/people/api";
import { Button } from "../../../../shared/ui/Button";
import { ChoiceGroup } from "../../../../shared/ui/ChoiceRow";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { refusalWords } from "../../MenuEditForm";
import { actorNameOf } from "./assigneeNames";

type Item = Record<string, unknown>;

type Worker = { id: string; name: string };

type Props = { order: Item; onAssigned: () => void };

const assignTool = "taskmanager_task_assign";

const assignPermission = "task.assign";

const agentKind = "agent";

const actorKind = "actor";

const nobodyWords = "Not assigned";

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const loadWorkers = async (): Promise<Worker[]> => (await listAgents()).map((agent) => ({ id: agent.id, name: agent.name }));

const holderNameLoaders: Record<string, (id: string) => Promise<string>> = {
  [actorKind]: actorNameOf,
};

const loadHolderName = (kind: string, id: string) => async () => (id ? ((await holderNameLoaders[kind]?.(id)) ?? "") : "");

export function WorkOrderAssignee({ order, onAssigned }: Props) {
  const may = useMay(assignPermission);
  const workers = useLoad(loadWorkers, `workers:${openAgencyId()}`);
  const [choosing, setChoosing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [refused, setRefused] = useState("");
  const list = workers.state === "ready" ? workers.data : [];
  const holder = textOf(order.assignee_kind) === agentKind ? textOf(order.assigned_to) : "";
  const isCurrent = (worker: Worker) => worker.id === holder;
  const holderKind = textOf(order.assignee_kind);
  const holderId = textOf(order.assigned_to);
  const person = useLoad(loadHolderName(holderKind, holderId), `holder:${openAgencyId()}:${holderKind}:${holderId}`);
  const personName = person.state === "ready" ? person.data : "";
  const assignee = list.find(isCurrent)?.name || personName || nobodyWords;
  const assign = async (worker: Worker) => {
    setAssigning(true);
    setRefused("");
    try {
      await callTool("", assignTool, { taskID: textOf(order.id), agent_id: worker.id });
      setChoosing(false);
      onAssigned();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setAssigning(false);
    }
  };
  const open = () => {
    setRefused("");
    setChoosing(true);
  };
  const heldRows = assignee === nobodyWords ? [] : [<ListRow key="holder" title={assignee} />];
  const chooser = (
    <div key="chooser" className="sec-tools">
      <ChoiceGroup label="Assign to">
        {list.map((worker) => (
          <Button key={worker.id} kind="quiet" aria-current={isCurrent(worker) ? "true" : undefined} disabled={assigning || isCurrent(worker)} onClick={() => assign(worker)}>
            {isCurrent(worker) ? `${worker.name} (now)` : worker.name}
          </Button>
        ))}
      </ChoiceGroup>
      {refused ? <LoadFailed words={refused} /> : null}
      <Button kind="quiet" disabled={assigning} onClick={() => setChoosing(false)}>Cancel</Button>
    </div>
  );
  const assignAct = may && !choosing ? (
    <button type="button" className="sec-act" onClick={open}>Assign</button>
  ) : undefined;
  return <Section word="Assignee" icon="users" rows={may && choosing ? [...heldRows, chooser] : heldRows} empty={{ words: `${nobodyWords} yet.` }} foot={assignAct} />;
}
