import { useId, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; unitBefore?: string; unitAfter?: string };

export function Field({ label, error, unitBefore, unitAfter, ...rest }: Props) {
  const id = useId();
  return (
    <div className="field">
      <label className="flabel" htmlFor={id}>
        {label}
      </label>
      <div className={error ? "input err" : "input"}>
        {unitBefore ? <span className="unit">{unitBefore}</span> : null}
        <input id={id} type="text" aria-invalid={error ? true : undefined} {...rest} />
        {unitAfter ? <span className="unit">{unitAfter}</span> : null}
      </div>
      {error ? <p className="ferr">{error}</p> : null}
    </div>
  );
}
