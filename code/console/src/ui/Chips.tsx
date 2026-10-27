import { Chip } from "./Chip";
import type { ChipsProps } from "./props";

export function Chips({ items }: ChipsProps) {
  return (
    <div className="row">
      {items.map((item, i) => (
        <Chip key={i}>{item}</Chip>
      ))}
    </div>
  );
}
