import { Button } from "../../shared/ui/Button";
import { SectionHeading } from "../../shared/ui/SectionHeading";
import { TextArea } from "../../shared/ui/TextArea";
import { editKey, type Edits } from "./amend";
import type { EarlierStep } from "./api";
import "./amendDraft.css";

type Props = { earlier: EarlierStep[]; edits: Edits; onChange: (edits: Edits) => void };

export function AmendDraft({ earlier, edits, onChange }: Props) {
  const put = (key: string, edit: Edits[string]) => onChange({ ...edits, [key]: edit });
  const drop = (key: string) => {
    const { [key]: _gone, ...rest } = edits;
    onChange(rest);
  };

  return (
    <>
      <SectionHeading>Work so far</SectionHeading>
      {earlier.map((step, i) => (
        <section key={i}>
          <p>
            <strong>{step.stepTitle}</strong>
          </p>
          <p className="meta">{step.roleName}</p>
          <dl>
            {step.answers.map((a, j) => {
              const key = editKey(i, j);
              const edit = edits[key];
              const text = edit?.text ?? a.answer;
              return (
                <div key={j} className="amend-row">
                  <div className="amend-answer">
                    {edit && !edit.struck ? (
                      <TextArea label={a.prompt} value={edit.text} onChange={(e) => put(key, { text: e.target.value, struck: false })} />
                    ) : (
                      <>
                        <dt className="meta">{a.prompt}</dt>
                        <dd>{edit?.struck ? <del>{text}</del> : a.answer}</dd>
                      </>
                    )}
                  </div>
                  <Button kind="text" onClick={() => put(key, { text, struck: false })}>Change</Button>
                  {edit?.struck ? (
                    <Button kind="text" onClick={() => drop(key)}>Keep</Button>
                  ) : (
                    <Button kind="text" onClick={() => put(key, { text, struck: true })}>Strike out</Button>
                  )}
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </>
  );
}
