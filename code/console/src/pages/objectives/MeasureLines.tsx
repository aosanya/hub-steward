import { useI18n } from "../../i18n";
import { Chip, Stack } from "../../ui";
import { measureProgress, type Measure } from "./objectivesData";

export function MeasureLines({ measures }: { measures: Measure[] }) {
  const { t } = useI18n();
  if (measures.length === 0)
    return <span className="soft">{t("objectives.noMeasure")}</span>;
  return (
    <Stack gap={4}>
      {measures.map((measure, index) => (
        <div key={measure.id || String(index)}>
          <strong>{measure.name}</strong>{" "}
          <span className="count">{measureProgress(measure)}</span>{" "}
          {measure.status ? <Chip kind="mute">{measure.status}</Chip> : null}
        </div>
      ))}
    </Stack>
  );
}
