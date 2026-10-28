import type { ReactNode } from "react";

type Props = { id: string; label: string; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode };

export function Labelled({ id, label, hint, error, required = true, children }: Props) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required && (
          <span className="req" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}
