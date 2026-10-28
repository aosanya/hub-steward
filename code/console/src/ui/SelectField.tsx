import { Icon } from "./Icon";
import { toOptionItems } from "./fieldValues";
import type { SelectFieldProps } from "./props";

export function SelectField({ icon, label, value, options, onChange, className }: SelectFieldProps) {
  const controlled = value === undefined ? {} : { value, onChange: (e: { target: { value: string } }) => onChange?.(e.target.value) };
  return (
    <label className={className ? `lang ${className}` : "lang"}>
      <Icon name={icon} size={16} />
      <span className="sr">{label}</span>
      <select {...controlled}>
        {toOptionItems(options).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
