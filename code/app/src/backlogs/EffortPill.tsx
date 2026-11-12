import { Chip } from "../ui/Chip";
import { effortKnown, effortLabel } from "./effort";
import { EffortMenu } from "./EffortMenu";

type Props = { effort?: string; onPick?: (effort: string) => void };

export function EffortPill({ effort, onPick }: Props) {
  if (onPick) return <EffortMenu effort={effort ?? ""} onPick={onPick} />;
  return effortKnown(effort) ? <Chip>{effortLabel(effort)}</Chip> : null;
}
