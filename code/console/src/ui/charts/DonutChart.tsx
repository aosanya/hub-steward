import type { CSSProperties } from "react";
import "./charts.css";
import { ChartEmpty } from "./ChartEmpty";
import { Swatch } from "./ChartLegend";
import { percentOf, shortTokens, tokenCount } from "./shortTokens";

export type DonutSlice = { name: string; color: string; value: number };

export type DonutChartProps = {
  slices: DonutSlice[];
  center: string;
  sub: string;
  title: string;
  emptyText?: string;
  words?: { tokens?: string };
};

const RADIUS = 62;
const STROKE = 26;
const GAP = 2.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({ slices, center, sub, title, emptyText = "No tokens in this span.", words }: DonutChartProps) {
  const tokensWord = words?.tokens ?? "tokens";
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return <ChartEmpty text={emptyText} />;
  const shown = slices.filter((slice) => slice.value > 0);
  let start = 0;
  const arcs = shown.map((slice) => {
    const length = (CIRCUMFERENCE * slice.value) / total;
    const dash = Math.max(length - GAP, 0.5);
    const arc = { slice, dash, offset: -start };
    start += length;
    return arc;
  });

  return (
    <div className="chart">
      <div className="donut">
        <svg viewBox="0 0 180 180" role="img" aria-label={title}>
          <title>{title}</title>
          {arcs.map(({ slice, dash, offset }) => (
            <circle
              key={slice.name}
              className="ch-slice"
              style={{ "--c": slice.color } as CSSProperties}
              cx={90}
              cy={90}
              r={RADIUS}
              strokeWidth={STROKE}
              strokeDasharray={`${dash.toFixed(2)} ${(CIRCUMFERENCE - dash).toFixed(2)}`}
              strokeDashoffset={offset.toFixed(2)}
              transform="rotate(-90 90 90)"
            >
              <title>{`${slice.name}: ${tokenCount(slice.value)} ${tokensWord}, ${percentOf(slice.value, total)}%`}</title>
            </circle>
          ))}
          <text className="ch-total" x={90} y={92} textAnchor="middle">
            {center}
          </text>
          <text className="ch-sub" x={90} y={110} textAnchor="middle">
            {sub}
          </text>
        </svg>
        <ul className="donut-list">
          {shown.map((slice) => (
            <li key={slice.name}>
              <Swatch color={slice.color} />
              {slice.name}
              <span className="count">{`${shortTokens(slice.value)} · ${percentOf(slice.value, total)}%`}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
