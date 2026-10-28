import { Icon } from "./Icon";
import type { AvatarProps, GlyphProps, MarkProps } from "./props";

export const initials = (name: string) =>
  name
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((word) => /^[\p{L}\p{N}]/u.test(word))
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

export function Badge({ children, accent }: MarkProps) {
  return <span className={accent ? "badge accent" : "badge"}>{children}</span>;
}

export function Avatar({ name }: AvatarProps) {
  return <span className="badge avatar">{initials(name)}</span>;
}

export function Glyph({ name }: GlyphProps) {
  return (
    <span className="glyph">
      <Icon name={name} size={20} />
    </span>
  );
}
