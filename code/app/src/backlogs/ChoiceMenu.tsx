import { ActionsMenu } from "../ui/ActionsMenu";

export type Choice = { value: string; label: string };

type Props = { label: string; choices: Choice[]; current: string; onPick: (value: string) => void };

export function ChoiceMenu({ label, choices, current, onPick }: Props) {
  return <ActionsMenu label={label} actions={choices.map((one) => ({ label: one.label, current: one.value === current, onSelect: () => onPick(one.value) }))} />;
}
