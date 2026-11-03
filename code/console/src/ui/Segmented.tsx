import "./segmented.css";

export type SegmentedItem = { key: string; label: string; current: boolean; onSelect: () => void };

export type SegmentedProps = { label: string; items: SegmentedItem[] };

export function Segmented({ label, items }: SegmentedProps) {
  return (
    <div className="row" style={{ "--row-gap": "8px" } as Record<string, string>}>
      <span className="seg-label">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {items.map((item) => (
          <button key={item.key} type="button" className="seg-item" aria-pressed={item.current} onClick={item.onSelect}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
