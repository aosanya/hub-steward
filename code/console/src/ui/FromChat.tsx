import { useI18n } from "../i18n";
import { Button } from "./Button";
import { Icon } from "./Icon";
import type { FromChatProps } from "./props";

export function FromChat({ prompt, title, onClear, children }: FromChatProps) {
  const { t } = useI18n();
  return (
    <section className="from-chat" aria-label={t("ui.answerFromChat")}>
      <div className="from-chat-bar">
        <span className="bot-badge">
          <Icon name="robot" size={14} />
        </span>
        <span className="from-chat-text">
          {t("ui.answerTo")} <strong>{prompt}</strong>
        </span>
        {title ? <span className="muted">{title}</span> : null}
        <Button kind="quiet" size="xs" onClick={onClear}>
          {t("ui.clear")}
        </Button>
      </div>
      <div className="from-chat-body">{children}</div>
    </section>
  );
}
