import type { ReactNode } from "react";
import "./sectionHeading.css";

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="heading">{children}</h2>;
}
