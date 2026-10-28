import { Icon } from "./Icon";
import { toOptionItems } from "./fieldValues";
import type { ControlProps, SelectControlProps, TextareaControlProps } from "./props";

export function TextControl({ id, value, onChange, placeholder, disabled, label }: ControlProps) {
  return (
    <span className={disabled ? "control ctl off" : "control ctl"}>
      <input
        id={id}
        type="text"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </span>
  );
}

export function TextareaControl({ id, value, onChange, placeholder, disabled, label, rows = 3 }: TextareaControlProps) {
  return (
    <span className={disabled ? "control ctl off" : "control ctl"}>
      <textarea
        id={id}
        aria-label={label}
        rows={rows}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </span>
  );
}

export function SelectControl({ id, value, onChange, options, disabled, label }: SelectControlProps) {
  return (
    <span className={disabled ? "control ctl off" : "control ctl"}>
      <select id={id} aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)}>
        {toOptionItems(options).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevron" size={16} />
    </span>
  );
}
