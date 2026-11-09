import type { ReactNode } from "react";

export type ChipTone = "accent" | "info" | "success" | "danger";

type Props = { children: ReactNode; tone?: ChipTone; onClick?: () => void; pressed?: boolean };

export function Chip({ children, tone, onClick, pressed }: Props) {
  const className = tone ? `chip ${tone}` : "chip";
  return onClick ? (
    <button type="button" className={className} aria-pressed={pressed ?? false} onClick={onClick}>
      {children}
    </button>
  ) : (
    <span className={className}>{children}</span>
  );
}
