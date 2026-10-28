import { Icon } from "../ui/Icon";

type EntryFieldProps = {
  label: string;
  icon: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password";
  autoComplete?: string;
};

export function EntryField({ label, icon, value, onChange, type = "text", autoComplete }: EntryFieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="control">
        <Icon name={icon} size={16} />
        <input type={type} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
    </label>
  );
}
