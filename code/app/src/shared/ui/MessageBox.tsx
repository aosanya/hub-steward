import type { ReactNode } from "react";
import { useLanguage } from "../language/language";
import { Card, type CardTone } from "./Card";
import { Icon, type IconName } from "./Icon";
import "./messageBox.css";

export type MessageTone = CardTone;

const icons: Record<MessageTone, IconName> = { error: "alert", warning: "warning", info: "info", success: "check" };

type Props = { words: string; tone?: MessageTone; title?: string; children?: ReactNode };

export function MessageBox({ words, tone = "error", title, children }: Props) {
  const { words: language } = useLanguage();
  const headings: Record<MessageTone, string> = {
    error: language.messageErrorTitle,
    warning: language.messageWarningTitle,
    info: language.messageInfoTitle,
    success: language.messageSuccessTitle,
  };
  return (
    <Card tone={tone}>
      <div className="message-box" role={tone === "error" ? "alert" : "status"}>
        <span className="message-icon">
          <Icon name={icons[tone]} />
        </span>
        <div className="message-body">
          <p className="message-title">{title ?? headings[tone]}</p>
          <p className="message-text">{words}</p>
          {children}
        </div>
      </div>
    </Card>
  );
}
