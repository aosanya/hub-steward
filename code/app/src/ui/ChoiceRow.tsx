import type { ReactNode } from "react";

type RowProps = { type: "radio" | "checkbox"; label: string; checked: boolean; onChange: (checked: boolean) => void; name?: string };

export function ChoiceRow({ type, label, checked, onChange, name }: RowProps) {
  return (
    <label className="row">
      <input type={type} name={name} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="ttl">{label}</span>
    </label>
  );
}

export function ChoiceGroup({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <fieldset className="field">
      <legend className="flabel">{label}</legend>
      {children}
      {error ? <p className="ferr">{error}</p> : null}
    </fieldset>
  );
}
