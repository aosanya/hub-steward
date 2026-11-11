import type { CSSProperties, ReactNode } from "react";

export type ChipTone = "accent" | "info" | "success" | "danger" | "waiting" | "sinbin";

type Props = { children: ReactNode; tone?: ChipTone; hue?: number; shade?: number; onClick?: () => void; pressed?: boolean; title?: string };

export function Chip({ children, tone, hue, shade = 0, onClick, pressed, title }: Props) {
  const className = tone ? `chip ${tone}` : hue === undefined ? "chip" : "chip hued";
  const style = hue === undefined ? undefined : ({ "--hue": hue, "--shade": shade } as CSSProperties);
  return onClick ? (
    <button type="button" className={className} style={style} title={title} aria-pressed={pressed ?? false} onClick={onClick}>
      {children}
    </button>
  ) : (
    <span className={className} style={style} title={title}>
      {children}
    </span>
  );
}
