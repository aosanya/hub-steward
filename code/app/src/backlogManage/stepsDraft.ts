export type DraftStep = { key: string; id: string; name: string; held: number };

let counter = 0;

export const newStep = (name: string): DraftStep => ({ key: `new-${++counter}`, id: "", name, held: 0 });

export const savedStep = (id: string, name: string, held: number): DraftStep => ({ key: id, id, name, held });

export const canRemove = (step: DraftStep) => step.held === 0;

export const canMoveUp = (steps: DraftStep[], index: number) => index > 0 && index < steps.length;

export const canMoveDown = (steps: DraftStep[], index: number) => index >= 0 && index < steps.length - 1;

const swapped = (steps: DraftStep[], a: number, b: number) => steps.map((step, i) => (i === a ? steps[b] : i === b ? steps[a] : step));

export const moveUp = (steps: DraftStep[], index: number) => (canMoveUp(steps, index) ? swapped(steps, index, index - 1) : steps);

export const moveDown = (steps: DraftStep[], index: number) => (canMoveDown(steps, index) ? swapped(steps, index, index + 1) : steps);

export const removeStep = (steps: DraftStep[], index: number) => (steps[index] && canRemove(steps[index]) ? steps.filter((_, i) => i !== index) : steps);

export const renameStep = (steps: DraftStep[], index: number, name: string) => steps.map((step, i) => (i === index ? { ...step, name } : step));

export const addStep = (steps: DraftStep[], name: string) => [...steps, newStep(name)];

export const heldWords = (held: number) => (held === 0 ? "No issues" : held === 1 ? "1 issue" : `${held} issues`);

export const draftProblem = (name: string, steps: DraftStep[]): string => {
  if (name.trim() === "") return "Give the backlog a name.";
  if (steps.length === 0) return "Add at least one step.";
  const names = steps.map((step) => step.name.trim().toLowerCase());
  if (names.some((step) => step === "")) return "Every step needs a name.";
  if (new Set(names).size !== names.length) return "Two steps have the same name.";
  return "";
};
