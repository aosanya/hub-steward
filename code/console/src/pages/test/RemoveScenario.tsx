import { useI18n } from "../../i18n";
import { Button, Card, Row } from "../../ui";

type Props = {
  name: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function RemoveScenario({ name, busy, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  return (
    <Card tight>
      <span>{t("test.removeAsk").replace("{name}", name)}</span>
      <Row>
        <Button kind="danger" size="sm" disabled={busy} onClick={onConfirm}>
          {t("test.removeConfirm")}
        </Button>
        <Button kind="quiet" size="sm" disabled={busy} onClick={onCancel}>
          {t("cancel")}
        </Button>
      </Row>
    </Card>
  );
}
