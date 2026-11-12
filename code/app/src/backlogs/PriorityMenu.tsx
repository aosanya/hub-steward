import { capitalised } from "./capitalised";
import { ChoiceMenu } from "./ChoiceMenu";

export const priorities = ["critical", "high", "medium", "low"];

export const priorityLabel = (priority?: string) => (priority ? `Priority: ${capitalised(priority)}` : "Priority");

type Props = { priority: string; onPick: (priority: string) => void };

export function PriorityMenu({ priority, onPick }: Props) {
  return <ChoiceMenu label={priorityLabel(priority)} choices={priorities.map((one) => ({ value: one, label: capitalised(one) }))} current={priority} onPick={onPick} />;
}
