import { useId, type TextareaHTMLAttributes } from "react";
import "./textArea.css";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string };

export function TextArea({ label, ...rest }: Props) {
  const id = useId();
  return (
    <div className="field">
      <label className="flabel" htmlFor={id}>
        {label}
      </label>
      <textarea id={id} className="textarea" rows={3} {...rest} />
    </div>
  );
}
