import { useI18n } from "../../i18n";
import { Button, SelectControl, Stack, TextControl } from "../../ui";
import { sourceKind, type Source, type SourceKind } from "./sourceFlags";

export const sourceKinds: SourceKind[] = ["step", "record", "ledger", "fixed"];

export const sourceWords: Record<SourceKind, string> = {
  step: "calcstep.inputs.sourceStep",
  record: "calcstep.inputs.sourceRecord",
  ledger: "calcstep.inputs.sourceLedger",
  fixed: "calcstep.inputs.sourceFixed",
};

type SourcePickerProps = {
  input: string;
  source: Source | null;
  onChoose?: (kind: SourceKind | null) => void;
  onFixedValue?: (value: string) => void;
};

export function SourcePicker({ input, source, onChoose, onFixedValue }: SourcePickerProps) {
  const { t } = useI18n();
  const kind = sourceKind(source);
  const options = [{ value: "", label: t("calcstep.inputs.choose") }, ...sourceKinds.map((k) => ({ value: k, label: t(sourceWords[k]) }))];
  return (
    <Stack gap={8}>
      <SelectControl
        label={t("calcstep.inputs.whereFrom").replace("{input}", input)}
        value={kind ?? ""}
        options={options}
        onChange={(value) => onChoose?.(value === "" ? null : (value as SourceKind))}
      />
      {kind === null ? (
        <div role="group" aria-label={t("calcstep.inputs.sourcesFor").replace("{input}", input)}>
          <Stack gap={8}>
            {sourceKinds.map((k) => (
              <Button key={k} kind="quiet" size="sm" onClick={() => onChoose?.(k)}>
                {t(sourceWords[k])}
              </Button>
            ))}
          </Stack>
        </div>
      ) : null}
      {source?.kind === "fixed" ? (
        <TextControl label={t("calcstep.inputs.fixedValue").replace("{input}", input)} value={source.value} onChange={onFixedValue} />
      ) : null}
    </Stack>
  );
}
