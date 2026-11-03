import "./charts.css";
import { ChartEmpty } from "./ChartEmpty";
import { ChartLegend } from "./ChartLegend";
import { shortTokens, tokenCount } from "./shortTokens";

export type StackedSeries = { name: string; color: string; values: number[] };

export type StackedBarsProps = {
  labels: string[];
  series: StackedSeries[];
  title: string;
  yTitle?: string;
  labelEvery?: number;
  emptyText?: string;
  words?: { peak?: string; tokens?: string; inAll?: string };
};

const steps = [5000, 10000, 20000, 25000, 50000, 100000, 200000, 250000, 500000];

const stepFor = (top: number) => steps.find((step) => top / step <= 5) ?? 1000000;

const WIDTH = 720;
const HEIGHT = 270;
const LEFT = 48;
const RIGHT = 8;
const TOP = 40;
const BOTTOM = 30;

export function StackedBars({ labels, series, title, yTitle = "Tokens per day", labelEvery = 7, emptyText = "No tokens in this span.", words }: StackedBarsProps) {
  const peakWord = words?.peak ?? "Peak";
  const tokensWord = words?.tokens ?? "tokens";
  const inAllWord = words?.inAll ?? "in all";
  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const peakValue = Math.max(0, ...totals);
  if (labels.length === 0 || peakValue === 0) return <ChartEmpty text={emptyText} />;
  const step = stepFor(peakValue);
  const ceiling = Math.ceil(peakValue / step) * step;
  const plotW = WIDTH - LEFT - RIGHT;
  const plotH = HEIGHT - TOP - BOTTOM;
  const band = plotW / labels.length;
  const bar = band * 0.66;
  const yOf = (value: number) => TOP + plotH * (1 - value / ceiling);
  const ticks: number[] = [];
  for (let tick = 0; tick <= ceiling; tick += step) ticks.push(tick);
  const peak = totals.indexOf(peakValue);
  const peakX = LEFT + band * peak + band / 2;

  return (
    <div className="chart">
      <ChartLegend items={series.map((s) => ({ name: s.name, color: s.color, value: shortTokens(s.values.reduce((a, b) => a + b, 0)) }))} />
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title}>
        <title>{title}</title>
        <text className="ch-axis" x={LEFT} y={12}>
          {yTitle}
        </text>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className={tick === 0 ? "ch-base" : "ch-grid"} x1={LEFT} x2={WIDTH - RIGHT} y1={yOf(tick)} y2={yOf(tick)} />
            <text className="ch-tick" x={LEFT - 8} y={yOf(tick) + 4} textAnchor="end">
              {shortTokens(tick)}
            </text>
          </g>
        ))}
        {labels.map((label, i) => {
          const x = LEFT + band * i + (band - bar) / 2;
          const visible = series.map((s, k) => ({ s, k, value: s.values[i] ?? 0 })).filter((entry) => entry.value > 0);
          let base = TOP + plotH;
          return (
            <g key={label + i} data-day={label}>
              <title>{`${label} · ${tokenCount(totals[i])} ${tokensWord} ${inAllWord}`}</title>
              {visible.map((entry, position) => {
                const height = (plotH * entry.value) / ceiling;
                const y = base - height;
                const tip = `${label} · ${entry.s.name}: ${tokenCount(entry.value)} ${tokensWord}`;
                const last = position === visible.length - 1;
                const r = Math.min(3, height);
                const shape = last ? (
                  <path
                    className="ch-seg"
                    fill={entry.s.color}
                    d={`M${x.toFixed(1)},${base.toFixed(1)}V${(y + r).toFixed(1)}a${r.toFixed(1)},${r.toFixed(1)} 0 0 1 ${r.toFixed(1)},${(-r).toFixed(1)}h${(bar - 2 * r).toFixed(1)}a${r.toFixed(1)},${r.toFixed(1)} 0 0 1 ${r.toFixed(1)},${r.toFixed(1)}V${base.toFixed(1)}Z`}
                  >
                    <title>{tip}</title>
                  </path>
                ) : (
                  <rect className="ch-seg" fill={entry.s.color} x={x} y={y} width={bar} height={height}>
                    <title>{tip}</title>
                  </rect>
                );
                base = y;
                return <g key={entry.k}>{shape}</g>;
              })}
              {i % labelEvery === 0 ? (
                <text className="ch-tick" x={x + bar / 2} y={HEIGHT - 8} textAnchor="middle">
                  {label}
                </text>
              ) : null}
            </g>
          );
        })}
        <text className="ch-peak" x={peakX} y={yOf(peakValue) - 6} textAnchor={peakX > WIDTH - 90 ? "end" : "middle"}>
          {`${peakWord} ${labels[peak]}: ${shortTokens(peakValue)}`}
        </text>
      </svg>
    </div>
  );
}
