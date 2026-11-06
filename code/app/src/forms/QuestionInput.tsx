import type { FormQuestion } from "./api";
import { ChoiceGroup, ChoiceRow } from "../ui/ChoiceRow";
import { Field } from "../ui/Field";
import { fileLimit, filesOf, isChoice, isFile, type Given } from "../pages/forms/answers";

export type QuestionEntry = { q: FormQuestion; value: Given; error?: string; onChange: (patch: Partial<Given>, error?: string) => void };

export function QuestionInput({ q, value, error, onChange }: QuestionEntry) {
  if (isChoice(q)) {
    const single = q.answer_type === "single_choice";
    return (
      <ChoiceGroup label={q.prompt} error={error}>
        {q.options.map((o) => (
          <ChoiceRow
            key={o.id}
            type={single ? "radio" : "checkbox"}
            name={q.id}
            label={o.label}
            checked={value.options.includes(o.id)}
            onChange={(on) => onChange({ options: single ? [o.id] : on ? [...value.options, o.id] : value.options.filter((x) => x !== o.id) })}
          />
        ))}
      </ChoiceGroup>
    );
  }
  if (q.answer_type === "yes_no") {
    return (
      <ChoiceGroup label={q.prompt} error={error}>
        {(["yes", "no"] as const).map((v) => (
          <ChoiceRow key={v} type="radio" name={q.id} label={v === "yes" ? (q.yes_label ?? "Yes") : (q.no_label ?? "No")} checked={value.text === v} onChange={() => onChange({ text: v })} />
        ))}
      </ChoiceGroup>
    );
  }
  if (isFile(q)) {
    const limit = fileLimit(q);
    const names = filesOf(value);
    return (
      <>
        <Field
          label={q.prompt}
          type="file"
          accept={q.answer_type === "photo" ? "image/*" : undefined}
          capture={q.require_capture ? "environment" : undefined}
          multiple={limit > 1}
          error={error}
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []).map((f) => f.name);
            onChange({ text: "", files: picked.slice(0, limit) }, picked.length > limit ? `Choose at most ${limit} files` : undefined);
          }}
        />
        {q.require_capture ? <p className="meta">Take this photo now with the camera</p> : null}
        {limit > 1 ? <p className="meta">Up to {limit} files</p> : null}
        {names.map((name) => (
          <p key={name} className="meta">{name}</p>
        ))}
      </>
    );
  }
  const type = q.answer_type === "number" || q.answer_type === "currency" ? "number" : q.answer_type === "date" ? "date" : q.answer_type === "time" ? "time" : "text";
  return <Field label={q.prompt} type={type} value={value.text} error={error} onChange={(e) => onChange({ text: e.target.value })} />;
}
