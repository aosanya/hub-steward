import { Grid } from "./Layout";
import type { StatItem, StatsProps } from "./props";

export function Stat({ label, value, sub }: StatItem) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub ? <span className="stat-sub">{sub}</span> : null}
    </div>
  );
}

export function Stats({ items }: StatsProps) {
  return (
    <Grid min={11} gap={12}>
      {items.map((item, i) => (
        <Stat key={i} {...item} />
      ))}
    </Grid>
  );
}
