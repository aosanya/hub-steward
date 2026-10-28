import type { ReactNode } from "react";
import { Icon } from "./Icon";
import type { ButtonLook } from "./props";

const trailingIcons = ["arrow", "chevron", "chevron-down"];

export const buttonClass = ({ kind = "primary", size, wide }: ButtonLook, extra?: string) =>
  ["btn", kind, size ?? "", wide ? "act" : "", extra ?? ""].filter(Boolean).join(" ");

export function ButtonContent({ icon, children }: { icon?: string; children?: ReactNode }) {
  if (!icon) return <>{children}</>;
  const mark = <Icon name={icon} size={16} stroke={2.2} />;
  return trailingIcons.includes(icon) ? (
    <>
      {children}
      {mark}
    </>
  ) : (
    <>
      {mark}
      {children}
    </>
  );
}
