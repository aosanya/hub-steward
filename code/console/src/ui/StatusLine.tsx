import type { StatusLineProps } from "./props";

export function StatusLine({ text, failed }: StatusLineProps) {
  return (
    <p className={failed ? "muted foot error" : "muted foot"} role="status">
      {text}
    </p>
  );
}
