import { iconPaths } from "./icons";

export type IconProps = { name: string; size?: number; stroke?: number; className?: string };

export const iconNames = Object.keys(iconPaths);

export function Icon({ name, size = 16, stroke = 2, className }: IconProps) {
  if (!Object.hasOwn(iconPaths, name)) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: iconPaths[name] }}
    />
  );
}
