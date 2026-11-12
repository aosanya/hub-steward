import { ChoiceMenu } from "./ChoiceMenu";
import { effortLabel, effortWords, efforts } from "./effort";

type Props = { effort: string; onPick: (effort: string) => void };

export function EffortMenu({ effort, onPick }: Props) {
  return <ChoiceMenu label={effortLabel(effort)} choices={efforts.map((one) => ({ value: one, label: effortWords(one) }))} current={effort} onPick={onPick} />;
}
