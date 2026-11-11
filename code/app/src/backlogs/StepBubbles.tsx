import { TextChip } from "../ui/TextChip";
import { topSteps, type StepCount } from "./stepCounts";

export function StepBubbles({ counts }: { counts: StepCount[] }) {
  const shown = topSteps(counts);
  return shown.length === 0 ? null : (
    <span className="step-counts">
      {shown.map((one) => (
        <TextChip key={one.name} text={one.name}>{`${one.name} ${one.issues}`}</TextChip>
      ))}
    </span>
  );
}
