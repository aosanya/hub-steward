import type { ChipProps } from "./props";

export function Chip({ kind, children }: ChipProps) {
  return <span className={kind ? `tag ${kind}` : "tag"}>{children}</span>;
}
