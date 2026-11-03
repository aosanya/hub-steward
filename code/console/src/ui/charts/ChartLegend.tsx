import type { CSSProperties } from "react";
import "./charts.css";

export type LegendItem = { name: string; color: string; value?: string };

export function Swatch({ color }: { color: string }) {
  return <span className="swatch" style={{ "--c": color } as CSSProperties} />;
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.name}>
          <Swatch color={item.color} />
          {item.name}
          {item.value ? <span className="count">{item.value}</span> : null}
        </li>
      ))}
    </ul>
  );
}
