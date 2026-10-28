import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import type { FilterChipProps } from "./props";

export function FilterChip({ text, onRemove }: FilterChipProps) {
  const { t } = useI18n();
  return (
    <span className="filter">
      {text}
      <button type="button" aria-label={t("ui.removeFilter").replace("{filter}", text)} onClick={onRemove}>
        <Icon name="cross" size={12} stroke={2.6} />
      </button>
    </span>
  );
}
