import type { ProgressProps } from "./props";

export function Progress({ pct, label }: ProgressProps) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="progress">
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={width}>
        <div className="fill" style={{ width: `${width}%` }} />
      </div>
      {label ? <span className="count">{label}</span> : null}
    </div>
  );
}
