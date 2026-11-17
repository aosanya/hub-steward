import { useI18n } from "../../i18n";
import { Card, Cell, Chip, DataTable, Stack } from "../../ui";
import type { ChipKind } from "../../ui";
import { SourcePicker } from "./SourcePicker";
import { sourceFlag, sourceType, type Fits, type Flag, type InputRow, type SourceKind, type ValueKind } from "./sourceFlags";

type InputsCardProps = {
  rows: InputRow[];
  fits?: Fits;
  onChoose?: (input: string, kind: SourceKind | null) => void;
  onFixedValue?: (input: string, value: string) => void;
};

const flagWords: Record<Flag, string> = {
  "no-source": "calcstep.inputs.flagNoSource",
  reworded: "calcstep.inputs.flagReworded",
  "wrong-type": "calcstep.inputs.flagWrongType",
};

const flagChip: Record<Flag, ChipKind> = { "no-source": "bad", reworded: "warn", "wrong-type": "bad" };

export function InputsCard({ rows, fits, onChoose, onFixedValue }: InputsCardProps) {
  const { t } = useI18n();
  const typeName = (type: ValueKind) => t(`calcstep.inputs.type.${type}`);
  const typePhrase = (type: ValueKind) => t(`calcstep.inputs.a.${type}`);

  const noteOf = (row: InputRow, flag: Flag | null): string | null => {
    const { source } = row;
    if (flag === "no-source") return t("calcstep.inputs.noteNoSource");
    if (source === null || source.kind === "ledger" || source.kind === "fixed") return null;
    const place = source.kind === "step" ? source.step : source.record;
    if (flag === "reworded")
      return t("calcstep.inputs.noteReworded").replace("{place}", place).replace("{was}", source.question).replace("{now}", source.questionNow ?? "");
    const type = sourceType(source);
    return t("calcstep.inputs.noteSource").replace("{place}", place).replace("{question}", source.question).replace("{type}", type ? typePhrase(type) : "");
  };

  const checkOf = (row: InputRow, flag: Flag | null) =>
    flag ? <Chip kind={flagChip[flag]}>{t(flagWords[flag])}</Chip> : <Chip kind="ok">{t("calcstep.inputs.fits").replace("{type}", typeName(row.type))}</Chip>;

  const tableRows = rows.map((row) => {
    const flag = sourceFlag(row, fits);
    const note = noteOf(row, flag);
    return {
      key: row.name,
      cells: [
        <Cell key="input" text={row.name} sub={typeName(row.type)} />,
        <Stack key="source" gap={8}>
          <SourcePicker
            input={row.name}
            source={row.source}
            onChoose={(kind) => onChoose?.(row.name, kind)}
            onFixedValue={(value) => onFixedValue?.(row.name, value)}
          />
          {note ? <span className="cell-sub">{note}</span> : null}
        </Stack>,
        checkOf(row, flag),
      ],
    };
  });

  return (
    <Card title={t("calcstep.inputs.title")} level={3} actions={<span className="muted">{t("calcstep.inputs.hint")}</span>}>
      <DataTable
        columns={[t("calcstep.inputs.colInput"), t("calcstep.inputs.colSource"), t("calcstep.inputs.colCheck")]}
        rows={tableRows}
        empty={t("calcstep.inputs.empty")}
      />
    </Card>
  );
}
