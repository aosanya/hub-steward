import "./backlogManage.css";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { ListRow, Rows } from "../ui/ListRow";
import { addStep, canMoveDown, canMoveUp, canRemove, heldWords, moveDown, moveUp, removeStep, type DraftStep } from "./stepsDraft";

type Props = { steps: DraftStep[]; onChange: (steps: DraftStep[]) => void; showHeld: boolean };

function Controls({ steps, index, onChange }: { steps: DraftStep[]; index: number; onChange: (steps: DraftStep[]) => void }) {
  const step = steps[index];
  return (
    <>
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
  const add = () => {
    if (adding.trim() === "") return;
    onChange(addStep(steps, adding.trim()));
    setAdding("");
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
            end={<Controls steps={steps} index={index} onChange={onChange} />}
          />
        ))}
      </Rows>
      <Field label="New step" value={adding} onChange={(event) => setAdding(event.target.value)} onKeyDown={(event) => event.key === "Enter" && add()} />
      <Button onClick={add} disabled={adding.trim() === ""}>
        Add a step
      </Button>
    </div>
  );
}
