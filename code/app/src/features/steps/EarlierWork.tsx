import type { EarlierStep } from "./api";

export function EarlierWork({ earlier }: { earlier: EarlierStep[] }) {
  return (
    <>
      {earlier.map((step, i) => (
        <section key={i}>
          <p>
            <strong>{step.stepTitle}</strong>
          </p>
          <p className="meta">{step.roleName}</p>
          <dl>
            {step.answers.map((a, j) => (
              <div key={j}>
                <dt className="meta">{a.prompt}</dt>
                <dd>{a.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  );
}
