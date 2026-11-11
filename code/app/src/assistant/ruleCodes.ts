import { markNames } from "../backlogs/marks";
import { DURATION_UNITS, fieldSpec, fieldSpecs, PRIORITIES } from "../smartBacklog/fields";
import { FIELD_IDS, type FieldId } from "../smartBacklog/types";

const marks = markNames.map((mark) => mark.toLowerCase());

const durationPattern = new RegExp(`^[1-9]\\d* (${DURATION_UNITS.join("|")})$`);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

const operatorCodes = (field: FieldId) => fieldSpec(field).operators.map((operator) => operator.id);

const valueHint: Partial<Record<FieldId, string>> = {
  mark: "Ready, Waiting, Sinbin or Blocked",
  priority: PRIORITIES.join(", "),
  last_changed: `a number and a unit such as '14 days' (${DURATION_UNITS.join(", ")})`,
  waits_on: "nothing",
};

export const ruleCodesLine = `Every rule you send uses codes, never the words the owner sees: the field codes are ${FIELD_IDS.join(", ")}; the operator codes are ${fieldSpecs()
  .map((spec) => `${operatorCodes(spec.id).join(" and ")} (${spec.id})`)
  .join(", ")}; a value is ${fieldSpecs()
  .flatMap((spec) => (valueHint[spec.id] ? [`${valueHint[spec.id]} for ${spec.id}`] : []))
  .join(", ")}. Never send 'Last changed', 'is in the last' or any other display word as a field or an operator.`;

const valueProblem = (field: FieldId, value: string): string => {
  const spelled = value.trim().toLowerCase();
  if (field === "mark" && !marks.includes(spelled)) return `The mark value "${value}" is not allowed; a mark is Ready, Waiting, Sinbin or Blocked.`;
  if (field === "priority" && !(PRIORITIES as readonly string[]).includes(spelled)) return `The priority "${value}" is not allowed; a priority is ${PRIORITIES.join(", ")}.`;
  if (field === "last_changed" && !durationPattern.test(value.trim())) return `The last_changed value "${value}" is not allowed; it is a number and a unit such as '14 days' (${DURATION_UNITS.join(", ")}).`;
  return "";
};

const ruleProblem = (raw: unknown): string => {
  if (!isObject(raw)) return "A rule must have a field, an operator and a value.";
  const field = text(raw.field);
  if (!(FIELD_IDS as readonly string[]).includes(field)) return `The rule field "${field}" is not a code; the field codes are ${FIELD_IDS.join(", ")}.`;
  const codes = operatorCodes(field as FieldId);
  const operator = text(raw.operator);
  if (!(codes as string[]).includes(operator)) return `The operator "${operator}" is not a code for ${field}; it takes ${codes.join(", ")}.`;
  return valueProblem(field as FieldId, text(raw.value));
};

export const rulesProblem = (raw: unknown): string => {
  const set = isObject(raw) ? raw : {};
  const list = Array.isArray(raw) ? raw : Array.isArray(set.rules) ? set.rules : [];
  for (const rule of list) {
    const problem = ruleProblem(rule);
    if (problem !== "") return problem;
  }
  return "";
};
