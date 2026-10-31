import { useI18n } from "../../i18n";
import type { Progress } from "../../data/reviewApi";
import { Card, Row } from "../../ui";

export function ProgressCard({ progress, area }: { progress: Progress; area?: string }) {
  const { t } = useI18n();
  return (
    <Card>
      <Row gap={14}>
        <span className="tool-spin progress-spin" aria-hidden="true" />
        <p role="status">
          {area
            ? t("review.progressArea").replace("{area}", area)
            : t("review.progress").replace("{done}", String(progress.done)).replace("{total}", String(progress.total))}
        </p>
      </Row>
    </Card>
  );
}
