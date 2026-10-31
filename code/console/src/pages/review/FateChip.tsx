import { useI18n } from "../../i18n";
import { Chip, Note, Row } from "../../ui";
import type { ChipKind } from "../../ui/props";
import type { Fate, Finding } from "../../data/reviewApi";

const kindOf: Record<Fate, ChipKind | undefined> = {
  new: undefined,
  fixed: "ok",
  still_open: "warn",
  withdrawn: "mute",
};

const isFirstReview = (finding: Finding) => finding.carried_from_id === "" && finding.fate === "new";

export function FateChip({ finding }: { finding: Finding }) {
  const { t } = useI18n();
  if (isFirstReview(finding) || finding.fate === "still_open") return null;
  return (
    <>
      <Row>
        <Chip kind={kindOf[finding.fate]}>{t(`review.fate.${finding.fate}`)}</Chip>
      </Row>
      {finding.fate_reason !== "" && <Note>{finding.fate_reason}</Note>}
    </>
  );
}
