import { isActionable } from "../../data/actionable";
import type { Finding, ReviewArea } from "../../data/reviewApi";
import { useI18n } from "../../i18n";
import { Note, Stack } from "../../ui";
import { FailedTab } from "./FailedTab";
import { FindingRow } from "./FindingRow";

type AreaBodyProps = {
  hubId: string;
  row: ReviewArea;
  onFinding: (finding: Finding) => void;
};

export function AreaBody({ hubId, row, onFinding }: AreaBodyProps) {
  const { t } = useI18n();
  if (row.status === "failed") return <FailedTab area={row} />;
  if (row.status === "reading") return <Note>{t("review.reading")}</Note>;
  const findings = row.findings.filter(isActionable);
  return (
    <Stack>
      {row.summary ? <Note>{row.summary}</Note> : null}
      {findings.length === 0 ? (
        <Note>{t("review.noFindings")}</Note>
      ) : (
        findings.map((finding) => (
          <FindingRow
            key={finding.id}
            hubId={hubId}
            finding={finding}
            onFinding={onFinding}
            area={row.area}
          />
        ))
      )}
    </Stack>
  );
}
