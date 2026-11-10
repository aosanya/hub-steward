import "./smartBacklog.css";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { ListRow, Rows } from "../ui/ListRow";
import { Segmented } from "../ui/Segmented";
import { Shell } from "../ui/Shell";
import { Sheet } from "../ui/Sheet";
import { DURATION_UNITS, choicesFor, fieldSpec, fieldSpecs, joinDuration, parseDuration, ruleComplete } from "./fields";
import { addRule, changeField, changeOperator, changeValue, countWords, draftProblem, emptyDraft, removeRule, toRuleSet, type Draft } from "./rulesDraft";
import { DuplicateRules, type CountMatches, type CreateSmartBacklog, type FieldChoices, type FieldId, type Match } from "./types";

type Props = { choices: FieldChoices; count: CountMatches; onCreate: CreateSmartBacklog; onBack: () => void; initial?: Draft; title?: string; submitLabel?: string; onOpenExisting?: (backlogId: string) => void };

type Picking = { at: number | "new" } | null;

const matchItems: { id: Match; label: string }[] = [{ id: "all", label: "all" }, { id: "any", label: "any" }];

function ValueControl({ draft, index, choices, onChange }: { draft: Draft; index: number; choices: FieldChoices; onChange: (draft: Draft) => void }) {
  const rule = draft.rules[index];
  const kind = fieldSpec(rule.field).value;
  const set = (value: string) => onChange(changeValue(draft, index, value));
  if (kind === "none") return null;
  if (kind === "choice") {
    const options = choicesFor(rule.field, choices);
    return (
      <select className="pick val" aria-label={`Value of rule ${index + 1}`} value={rule.value} onChange={(event) => set(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  if (kind === "duration") {
    const { amount, unit } = parseDuration(rule.value);
    return (
      <div className="rpair">
        <input className="pick val" inputMode="numeric" aria-label={`Number of rule ${index + 1}`} value={amount} onChange={(event) => set(joinDuration(event.target.value.replace(/\D/g, ""), unit))} />
        <select className="pick" aria-label={`Unit of rule ${index + 1}`} value={unit} onChange={(event) => set(joinDuration(amount, event.target.value))}>
          {DURATION_UNITS.map((each) => (
            <option key={each} value={each}>
              {each}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return <input className="pick val" aria-label={`Value of rule ${index + 1}`} value={rule.value} onChange={(event) => set(event.target.value)} />;
}

function RuleRow({ draft, index, choices, onChange, onPickField }: { draft: Draft; index: number; choices: FieldChoices; onChange: (draft: Draft) => void; onPickField: () => void }) {
  const rule = draft.rules[index];
  const spec = fieldSpec(rule.field);
  return (
    <div className="rule">
      <div className="rcols">
        <div className="rpair">
          <button type="button" className="pick" aria-label={`Field of rule ${index + 1}`} onClick={onPickField}>
            <span>{spec.label}</span>
            <span aria-hidden="true">⌄</span>
          </button>
          <select className="pick" aria-label={`Operator of rule ${index + 1}`} value={rule.operator} onChange={(event) => onChange(changeOperator(draft, index, event.target.value as typeof rule.operator))}>
            {spec.operators.map((operator) => (
              <option key={operator.id} value={operator.id}>
                {operator.label}
              </option>
            ))}
          </select>
        </div>
        <ValueControl draft={draft} index={index} choices={choices} onChange={onChange} />
      </div>
      <button type="button" className="icb" aria-label={`Remove rule ${index + 1}`} onClick={() => onChange(removeRule(draft, index))}>
        ×
      </button>
    </div>
  );
}

function FieldSheet({ onPick, onClose }: { onPick: (field: FieldId) => void; onClose: () => void }) {
  return (
    <Sheet title="Rule on" onClose={onClose}>
      <Rows>
        {fieldSpecs().map((spec) => (
          <ListRow key={spec.id} title={spec.label} onClick={() => onPick(spec.id)} />
        ))}
      </Rows>
    </Sheet>
  );
}

export function RulesScreen({ choices, count, onCreate, onBack, initial, title = "Add a smart backlog", submitLabel = "Create smart backlog", onOpenExisting }: Props) {
  const [draft, setDraft] = useState<Draft>(initial ?? emptyDraft());
  const [picking, setPicking] = useState<Picking>(null);
  const [matching, setMatching] = useState<number | null>(null);
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<DuplicateRules | null>(null);
  const countable = draft.rules.length > 0 && draft.rules.every(ruleComplete);
  const wanted = JSON.stringify(toRuleSet(draft));

  useEffect(() => {
    if (!countable) {
      setMatching(null);
      return;
    }
    let current = true;
    count(JSON.parse(wanted)).then(
      (found) => current && setMatching(found),
      () => current && setMatching(null),
    );
    return () => {
      current = false;
    };
  }, [countable, wanted, count]);

  const pick = (field: FieldId) => {
    if (picking === null) return;
    setDraft(picking.at === "new" ? addRule(draft, field, choices) : changeField(draft, picking.at, field, choices));
    setPicking(null);
  };

  const create = async () => {
    const found = draftProblem(draft);
    setProblem(found);
    setExisting(null);
    if (found !== "") return;
    setSaving(true);
    try {
      await onCreate(draft.name.trim(), toRuleSet(draft));
    } catch (error) {
      if (error instanceof DuplicateRules) setExisting(error);
      setProblem(error instanceof Error && error.message !== "" ? error.message : "The smart backlog could not be created. Try again.");
      setSaving(false);
    }
  };

  return (
    <Shell title={title} onBack={onBack} tabless>
      <Field label="Name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      <div className="field">
        <span className="flabel">Match</span>
        <Segmented items={matchItems} current={draft.match} label="Match" onChange={(match) => setDraft({ ...draft, match })} />
      </div>
      <div className="field">
        <span className="flabel">Rules</span>
        {draft.rules.length > 0 ? (
          <div className="rows">
            {draft.rules.map((_, index) => (
              <RuleRow key={index} draft={draft} index={index} choices={choices} onChange={setDraft} onPickField={() => setPicking({ at: index })} />
            ))}
          </div>
        ) : null}
        <Button onClick={() => setPicking({ at: "new" })}>+ Add a rule</Button>
      </div>
      {matching !== null ? (
        <Card>
          <span className="ttl" role="status">{countWords(matching)}</span>
          <span className="line">They update as issues change.</span>
        </Card>
      ) : null}
      {problem ? <p className="ferr" role="alert">{problem}</p> : null}
      {existing && onOpenExisting ? <Button onClick={() => onOpenExisting(existing.existingId)}>{`Open ${existing.existingName}`}</Button> : null}
      <Button kind="primary" onClick={create} disabled={saving}>
        {submitLabel}
      </Button>
      {picking ? <FieldSheet onPick={pick} onClose={() => setPicking(null)} /> : null}
    </Shell>
  );
}
