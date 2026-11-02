import { useI18n } from "../../i18n";
import { Chip } from "../../ui";
import type { RuleCheck } from "../../data/scenario";

export function RuleChip({ code, held }: RuleCheck) {
  const { t } = useI18n();
  return (
    <Chip kind={held ? "ok" : "bad"}>
      {t(held ? "test.ruleHeldChip" : "test.ruleFailedChip").replace(
        "{code}",
        code,
      )}
    </Chip>
  );
}
