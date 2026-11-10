import type { ChoiceFieldId, FieldChoices, FieldId, OperatorId, Rule } from "./types";
import { FIELD_IDS } from "./types";

export type ValueKind = "choice" | "text" | "none" | "duration";

type Operator = { id: OperatorId; label: string };

type FieldSpec = { id: FieldId; label: string; operators: Operator[]; value: ValueKind };

const has: Operator[] = [{ id: "has", label: "has" }, { id: "not_has", label: "does not have" }];
const is: Operator[] = [{ id: "is", label: "is" }, { id: "is_not", label: "is not" }];
const contains: Operator[] = [{ id: "contains", label: "contains" }, { id: "not_contains", label: "does not contain" }];
const waits: Operator[] = [{ id: "has_something", label: "has something" }, { id: "has_nothing", label: "has nothing" }];
const recent: Operator[] = [{ id: "in_last", label: "is in the last" }, { id: "not_in_last", label: "is not in the last" }];

const specs: FieldSpec[] = [
  { id: "tag", label: "Tag", operators: has, value: "choice" },
  { id: "mark", label: "Mark", operators: is, value: "choice" },
  { id: "backlog", label: "Backlog", operators: is, value: "choice" },
  { id: "step", label: "Step", operators: is, value: "choice" },
  { id: "priority", label: "Priority", operators: is, value: "choice" },
  { id: "title", label: "Title", operators: contains, value: "text" },
  { id: "description", label: "Description", operators: contains, value: "text" },
  { id: "waits_on", label: "Waits on", operators: waits, value: "none" },
  { id: "last_changed", label: "Last changed", operators: recent, value: "duration" },
];

export const DURATION_UNITS = ["days", "weeks", "months"] as const;

export const fieldSpec = (field: FieldId): FieldSpec => specs.find((spec) => spec.id === field) ?? specs[0];

export const fieldSpecs = (): FieldSpec[] => FIELD_IDS.map(fieldSpec);

export const isChoiceField = (field: FieldId): field is ChoiceFieldId => fieldSpec(field).value === "choice";

export const choicesFor = (field: FieldId, choices: FieldChoices): string[] => (isChoiceField(field) ? choices[field] : []);

export const operatorLabel = (rule: Rule): string => fieldSpec(rule.field).operators.find((operator) => operator.id === rule.operator)?.label ?? rule.operator;

export const parseDuration = (value: string): { amount: string; unit: string } => {
  const [amount = "", unit = DURATION_UNITS[0]] = value.split(" ");
  return { amount, unit };
};

export const joinDuration = (amount: string, unit: string): string => `${amount} ${unit}`;

export const blankRule = (field: FieldId, choices: FieldChoices): Rule => {
  const spec = fieldSpec(field);
  const kind = spec.value;
  const value = kind === "choice" ? (choicesFor(field, choices)[0] ?? "") : kind === "duration" ? joinDuration("30", DURATION_UNITS[0]) : "";
  return { field, operator: spec.operators[0].id, value };
};

export const ruleComplete = (rule: Rule): boolean => {
  const kind = fieldSpec(rule.field).value;
  if (kind === "none") return true;
  if (kind === "duration") return /^[1-9]\d* (days|weeks|months)$/.test(rule.value);
  return rule.value.trim() !== "";
};
