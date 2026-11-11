import type { ReactNode } from "react";
import { Card } from "../Card";
import { Icon } from "../Icon";

type Props = {
  icon: string;
  title: ReactNode;
  tone?: "ok" | "bad";
  stroke?: number;
  className?: string;
  heading?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
};

export function MsgCard({ icon, title, tone, stroke, className, heading = true, footer, children }: Props) {
  const titleClass = tone ? `msg-title ${tone}` : "msg-title";
  const named = (
    <span className={titleClass}>
      <Icon name={icon} size={16} stroke={stroke} />
      {title}
    </span>
  );
  return (
    <Card level={heading ? 3 : "plain"} className={className ? `msg-card ${className}` : "msg-card"} title={named} footer={footer}>
      {children}
    </Card>
  );
}
