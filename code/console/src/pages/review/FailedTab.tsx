import type { ReviewArea } from "../../data/reviewApi";
import { useI18n } from "../../i18n";
import { Chip, Row } from "../../ui";

export function FailedTab({ area }: { area: ReviewArea }) {
  const { t } = useI18n();
  return (
    <Row>
      <Chip kind="bad">{t("review.failedTab")}</Chip>
      <span>{area.failure_reason}</span>
    </Row>
  );
}
