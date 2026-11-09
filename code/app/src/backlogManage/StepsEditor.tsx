import "./backlogManage.css";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { ListRow, Rows } from "../ui/ListRow";
import { addStep, canMoveDown, canMoveUp, canRemove, heldWords, moveDown, moveUp, removeStep, renameStep, type DraftStep } from "./stepsDraft";

type Props = { steps: DraftStep[]; onChange: (steps: DraftStep[]) => void; showHeld: boolean };

type ControlProps = { steps: DraftStep[]; index: number; onChange: (steps: DraftStep[]) => void; onRename: (index: number) => void };

function Controls({ steps, index, onChange, onRename }: ControlProps) {
  const step = steps[index];
  return (
    <>
      <button type="button" className="icb" aria-label={`Rename ${step.name}`} onClick={() => onRename(index)}>
        ✎
      </button>
      <button type="button" className="icb" aria-label={`Move ${step.name} up`} disabled={!canMoveUp(steps, index)} onClick={() => onChange(moveUp(steps, index))}>
        ↑
      </button>
      <button type="button" className="icb" aria-label={`Move ${step.name} down`} disabled={!canMoveDown(steps, index)} onClick={() => onChange(moveDown(steps, index))}>
        ↓
      </button>
      <button type="button" className="icb" aria-label={`Remove ${step.name}`} disabled={!canRemove(step)} onClick={() => onChange(removeStep(steps, index))}>
        ×
      </button>
    </>
  );
}

export function StepsEditor({ steps, onChange, showHeld }: Props) {
  const [adding, setAdding] = useState("");
  const [renaming, setRenaming] = useState<{ key: string; name: string } | null>(null);
  const add = () => {
    if (adding.trim() === "") return;
    onChange(addStep(steps, adding.trim()));
    setAdding("");
  };
  const startRename = (index: number) => setRenaming({ key: steps[index].key, name: steps[index].name });
  const renamed = renaming ? steps.findIndex((step) => step.key === renaming.key) : -1;
  const applyRename = () => {
    if (renaming && renamed >= 0 && renaming.name.trim() !== "") onChange(renameStep(steps, renamed, renaming.name.trim()));
    setRenaming(null);
  };
  return (
    <div className="field">
      <span className="flabel">Steps, in order</span>
      <Rows>
        {steps.map((step, index) => (
          <ListRow
            key={step.key}
            title={step.name}
            meta={showHeld ? heldWords(step.held) : undefined}
            end={<Controls steps={steps} index={index} onChange={onChange} onRename={startRename} />}
          />
        ))}
      </Rows>
      {renaming && renamed >= 0 ? (
        <>
          <Field label={`New name for ${steps[renamed].name}`} value={renaming.name} onChange={(event) => setRenaming({ ...renaming, name: event.target.value })} onKeyDown={(event) => event.key === "Enter" && applyRename()} />
          <Button onClick={applyRename} disabled={renaming.name.trim() === ""}>
            Use this name
          </Button>
          <Button onClick={() => setRenaming(null)}>Keep the old name</Button>
        </>
      ) : null}
      <Field label="New step" value={adding} onChange={(event) => setAdding(event.target.value)} onKeyDown={(event) => event.key === "Enter" && add()} />
      <Button onClick={add} disabled={adding.trim() === ""}>
        Add a step
      </Button>
    </div>
  );
}
