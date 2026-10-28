import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";

export type StepState = "done" | "now" | "next" | "failed";

export type Step = { title: string; meta: ReactNode; state: StepState };

export function StepList({ steps }: { steps: Step[] }) {
  const list = (
    <ol className="timeline">
      {steps.map((step) => (
        <li
          key={step.title}
          className={`tl-item ${step.state === "failed" ? "now" : step.state}`}
          aria-current={step.state === "now" || step.state === "failed" ? "step" : undefined}
        >
          <span className="tl-dot">
            {step.state === "done" ? <Icon name="check" size={12} stroke={3.2} /> : null}
            {step.state === "failed" ? <Icon name="cross" size={12} stroke={3.2} /> : null}
          </span>
          <span className="tl-text">
            <span className="tl-title">{step.title}</span>
            <span className="tl-meta">{step.meta}</span>
          </span>
        </li>
      ))}
    </ol>
  );
  return steps.some((step) => step.state === "failed") ? <div className="ent-failed">{list}</div> : list;
}
