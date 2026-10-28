import type { ToggleProps } from "./props";

export function Toggle({ label, on, onChange, disabled, name, labelledBy, id }: ToggleProps) {
  return (
    <label className="toggle">
      <input
        className="sr"
        id={id}
        name={name}
        type="checkbox"
        role="switch"
        aria-labelledby={labelledBy}
        checked={on}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="track" />
      {label}
    </label>
  );
}
