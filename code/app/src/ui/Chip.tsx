import type { ReactNode } from "react";

export type ChipTone = "accent" | "info" | "success" | "danger";

export function Chip({ children, tone }: { children: ReactNode; tone?: ChipTone }) {
  return <span className={tone ? `chip ${tone}` : "chip"}>{children}</span>;
}
