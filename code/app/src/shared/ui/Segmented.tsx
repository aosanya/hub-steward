import type { ReactNode } from "react";
import "./segmented.css";

export type SegmentedItem<Id extends string = string> = { id: Id; label: ReactNode };

type Props<Id extends string> = { items: SegmentedItem<Id>[]; current: Id; onChange: (id: Id) => void; label?: string; disabled?: boolean };

export function Segmented<Id extends string>({ items, current, onChange, label, disabled }: Props<Id>) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {items.map((item) => (
        <button key={item.id} type="button" disabled={disabled} aria-pressed={item.id === current} onClick={() => item.id !== current && onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
