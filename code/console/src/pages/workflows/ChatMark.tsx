import { useI18n } from "../../i18n";
import { Badge, Icon } from "../../ui";

export function ChatMark() {
  const { t } = useI18n();
  return (
    <span role="img" aria-label={t("workflows.opensInChat")} title={t("workflows.opensInChat")}>
      <Badge accent>
        <Icon name="chat" size={14} />
      </Badge>
    </span>
  );
}
