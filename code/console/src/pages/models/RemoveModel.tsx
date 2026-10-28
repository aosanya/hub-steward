import { useI18n } from "../../i18n";
import { Button, Card, Row } from "../../ui";

type Props = { title: string; busy: boolean; onConfirm: () => void; onCancel: () => void };

export function RemoveModel({ title, busy, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  return (
    <Card tight>
      <span>{t("models.removeAsk").replace("{model}", title)}</span>
      <Row>
        <Button kind="danger" size="sm" disabled={busy} onClick={onConfirm}>
          {t("models.removeConfirm")}
        </Button>
        <Button kind="quiet" size="sm" disabled={busy} onClick={onCancel}>
          {t("models.cancel")}
        </Button>
      </Row>
    </Card>
  );
}
