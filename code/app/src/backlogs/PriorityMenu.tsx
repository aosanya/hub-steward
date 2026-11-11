import { ActionsMenu } from "../ui/ActionsMenu";

export const priorities = ["critical", "high", "medium", "low"];

type Props = { priority: string; onPick: (priority: string) => void };

export function PriorityMenu({ priority, onPick }: Props) {
  return <ActionsMenu label={priority || "priority"} actions={priorities.map((one) => ({ label: one, current: one === priority, onSelect: () => onPick(one) }))} />;
}
