import type { ReactNode } from "react";
import "./sectionHeading.css";

export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const heading = <h2 className="heading">{children}</h2>;
  return action ? (
    <div className="heading-row">
      {heading}
      {action}
    </div>
  ) : (
    heading
  );
}
