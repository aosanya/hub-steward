import { ErrorLine } from "../../entry/ErrorLine";
import { useI18n } from "../../i18n";
import { Button, Card, Row } from "../../ui";

export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <Card>
      <ErrorLine>{t("loadFailed")}</ErrorLine>
      <Row>
        <Button kind="quiet" onClick={onRetry}>
          {t("retry")}
        </Button>
      </Row>
    </Card>
  );
}
