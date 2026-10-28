import type { ReactNode } from "react";
import { Icon } from "../Icon";

type Props = {
  icon: string;
  title: ReactNode;
  tone?: "ok" | "bad";
  stroke?: number;
  className?: string;
  heading?: boolean;
  children?: ReactNode;
};

export function MsgCard({ icon, title, tone, stroke, className, heading = true, children }: Props) {
  const titleClass = tone ? `msg-title ${tone}` : "msg-title";
  const headingProps = heading ? ({ role: "heading", "aria-level": 3 } as const) : {};
  return (
    <div className={className ? `msg-card ${className}` : "msg-card"}>
      <div className={titleClass} {...headingProps}>
        <Icon name={icon} size={16} stroke={stroke} />
        {title}
      </div>
      {children}
    </div>
  );
}
