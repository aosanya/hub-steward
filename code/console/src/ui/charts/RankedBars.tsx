import type { CSSProperties } from "react";
import "./charts.css";
import { ChartEmpty } from "./ChartEmpty";
import { percentOf, shortTokens, tokenCount } from "./shortTokens";

export type RankedRow = { name: string; tokensIn: number; tokensOut: number; requests?: number; onOpen?: () => void };

export type RankedBarsProps = {
  rows: RankedRow[];
  emptyText?: string;
  words?: { input?: string; output?: string; tokensIn?: string; tokensOut?: string };
};

export function RankedBars({ rows, emptyText = "No tokens in this span.", words }: RankedBarsProps) {
  const inputWord = words?.input ?? "Input";
  const outputWord = words?.output ?? "Output";
  const tokensInWord = words?.tokensIn ?? "tokens in";
  const tokensOutWord = words?.tokensOut ?? "tokens out";
  const total = rows.reduce((sum, row) => sum + row.tokensIn + row.tokensOut, 0);
  if (rows.length === 0 || total <= 0) return <ChartEmpty text={emptyText} />;
  const top = Math.max(...rows.map((row) => row.tokensIn + row.tokensOut));

  return (
    <div className="chart">
      <ul className="chart-legend">
        <li>
          <span className="swatch" style={{ "--c": "var(--accent)" } as CSSProperties} />
          {inputWord}
        </li>
        <li>
          <span className="swatch part" />
          {outputWord}
        </li>
      </ul>
      <ul className="rank">
        {rows.map((row) => {
          const tip = `${row.name}: ${tokenCount(row.tokensIn)} ${tokensInWord}, ${tokenCount(row.tokensOut)} ${tokensOutWord}`;
          const inner = (
            <>
              <span className="rank-line">
                <span className="rank-name">{row.name}</span>
                <span className="count">{`${shortTokens(row.tokensIn + row.tokensOut)} · ${percentOf(row.tokensIn + row.tokensOut, total)}%`}</span>
              </span>
              <span className="rank-track">
                <span className="rank-in" style={{ width: `${((row.tokensIn * 100) / top).toFixed(1)}%` }} />
                <span className="rank-out" style={{ width: `${((row.tokensOut * 100) / top).toFixed(1)}%` }} />
              </span>
            </>
          );
          return (
            <li key={row.name}>
              {row.onOpen ? (
                <button type="button" className="rank-row" title={tip} aria-label={tip} onClick={row.onOpen}>
                  {inner}
                </button>
              ) : (
                <span className="rank-row" title={tip} aria-label={tip} role="group">
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
