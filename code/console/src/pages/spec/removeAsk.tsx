import { useI18n } from "../../i18n";
import { Button, Card, Row } from "../../ui";

type RemoveAskProps = { question: string; confirm: string; busy: boolean; error: string; onConfirm: () => void; onCancel: () => void };

export function RemoveAsk({ question, confirm, busy, error, onConfirm, onCancel }: RemoveAskProps) {
  const { t } = useI18n();
  return (
    <Card tight>
      <span>{question}</span>
      {error ? (
        <p className="field-error error" role="alert">
          {error}
        </p>
      ) : null}
      <Row>
        <Button kind="danger" size="sm" disabled={busy} onClick={onConfirm}>
          {confirm}
        </Button>
        <Button kind="quiet" size="sm" disabled={busy} onClick={onCancel}>
          {t("cancel")}
        </Button>
      </Row>
    </Card>
  );
}
