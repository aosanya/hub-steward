import "./segmented.css";

export type SegmentedItem<Id extends string = string> = { id: Id; label: string };

type Props<Id extends string> = { items: SegmentedItem<Id>[]; current: Id; onChange: (id: Id) => void };

export function Segmented<Id extends string>({ items, current, onChange }: Props<Id>) {
  return (
    <div className="seg" role="group">
      {items.map((item) => (
        <button key={item.id} type="button" aria-pressed={item.id === current} onClick={() => item.id !== current && onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
