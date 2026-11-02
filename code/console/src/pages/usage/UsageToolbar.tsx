import { spans, type UsageGroup } from "../../data/usageBreakdown";
import { useI18n } from "../../i18n";
import { FilterChip, Segmented, Toolbar } from "../../ui";
import type { UsageQuery } from "./useUsageQuery";

type Props = { query: UsageQuery; roleName: string; showGroup: boolean };

const groups: UsageGroup[] = ["person", "agent"];

export function UsageToolbar({ query, roleName, showGroup }: Props) {
  const { t } = useI18n();
  const left = (
    <>
      <Segmented
        label={t("usage.show")}
        items={spans.map((span) => ({ key: span, label: t(`usage.span.${span}`), current: span === query.span, onSelect: () => query.change({ span }) }))}
      />
      {roleName ? <FilterChip text={t("usage.role").replace("{role}", roleName)} onRemove={() => query.change({ role: "" })} /> : null}
    </>
  );
  const right = showGroup ? (
    <Segmented
      label={t("usage.groupBy")}
      items={groups.map((group) => ({ key: group, label: t(`usage.group.${group}`), current: group === query.group, onSelect: () => query.change({ group }) }))}
    />
  ) : undefined;
  return <Toolbar left={left} right={right} />;
}
