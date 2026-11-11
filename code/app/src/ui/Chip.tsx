import type { CSSProperties, ReactNode } from "react";

export type ChipTone = "accent" | "info" | "success" | "danger";

type Props = { children: ReactNode; tone?: ChipTone; hue?: number; onClick?: () => void; pressed?: boolean };

export function Chip({ children, tone, hue, onClick, pressed }: Props) {
  const className = tone ? `chip ${tone}` : hue === undefined ? "chip" : "chip hued";
  const style = hue === undefined ? undefined : ({ "--hue": hue } as CSSProperties);
  return onClick ? (
    <button type="button" className={className} style={style} aria-pressed={pressed ?? false} onClick={onClick}>
      {children}
    </button>
  ) : (
    <span className={className} style={style}>
      {children}
    </span>
  );
}
