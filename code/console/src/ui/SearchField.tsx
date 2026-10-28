import { Icon } from "./Icon";
import type { SearchFieldProps } from "./props";

export function SearchField({ placeholder, value, onChange }: SearchFieldProps) {
  const controlled = value === undefined ? {} : { value, onChange: (e: { target: { value: string } }) => onChange?.(e.target.value) };
  return (
    <label className="search">
      <Icon name="search" size={16} />
      <span className="sr">{placeholder}</span>
      <input type="search" placeholder={placeholder} {...controlled} />
    </label>
  );
}
