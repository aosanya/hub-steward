import type { CSSProperties } from "react";
import "./charts.css";
import { ChartEmpty } from "./ChartEmpty";
import { Swatch } from "./ChartLegend";
import { shortTokens, tokenCount } from "./shortTokens";

export type HeatColumn = { name: string; color: string };

export type HeatmapProps = {
  rowNames: string[];
  columns: HeatColumn[];
  matrix: number[][];
  title: string;
  emptyText?: string;
  words?: { fewer?: string; more?: string; tokens?: string };
};

export const heatLevel = (value: number, top: number) => {
  if (value <= 0 || top <= 0) return 0;
  const share = value / top;
  if (share <= 0.1) return 1;
  if (share <= 0.25) return 2;
  if (share <= 0.45) return 3;
  if (share <= 0.7) return 4;
  return 5;
};

const keyShares = [14, 28, 44, 66, 100];

export function Heatmap({ rowNames, columns, matrix, title, emptyText = "No tokens in this span.", words }: HeatmapProps) {
  const tokensWord = words?.tokens ?? "tokens";
  const top = Math.max(0, ...matrix.flat());
  if (rowNames.length === 0 || top <= 0) return <ChartEmpty text={emptyText} />;

  return (
    <div className="chart">
      <table className="heat" aria-label={title}>
        <thead>
          <tr>
            <th />
            {columns.map((column) => (
              <th key={column.name} scope="col">
                <Swatch color={column.color} />
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowNames.map((name, r) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              {columns.map((column, c) => {
                const value = matrix[r]?.[c] ?? 0;
                const tip = `${name} · ${column.name}: ${tokenCount(value)} ${tokensWord}`;
                return (
                  <td key={column.name} className={`h${heatLevel(value, top)}`} title={tip} aria-label={tip}>
                    {value ? shortTokens(value) : "–"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="heat-key">
        {words?.fewer ?? "Fewer tokens"}
        {keyShares.map((share) => (
          <i key={share} style={{ "--p": `${share}%` } as CSSProperties} />
        ))}
        {words?.more ?? "More tokens"}
      </div>
    </div>
  );
}
