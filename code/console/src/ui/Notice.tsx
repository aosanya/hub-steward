import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { useNotice } from "./noticeContext";
import type { NoticeProps } from "./props";
import "./notice.css";

export function Notice({ text, kind = "ok", onDismiss }: NoticeProps) {
  const { t } = useI18n();
  return (
    <div className={`notice ${kind}`} role={kind === "bad" ? "alert" : "status"}>
      <Icon name={kind === "bad" ? "alert" : "check"} size={18} stroke={2.4} />
      <span className="notice-text">{text}</span>
      <button type="button" className="notice-close" aria-label={t("notice.dismiss")} onClick={onDismiss}>
        <Icon name="cross" size={16} stroke={2.4} />
      </button>
    </div>
  );
}

export function NoticeBar() {
  const { message, dismiss } = useNotice();
  if (!message) return null;
  return <Notice key={message.id} text={message.text} kind={message.kind} onDismiss={dismiss} />;
}
