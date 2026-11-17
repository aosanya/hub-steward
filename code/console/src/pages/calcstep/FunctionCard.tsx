import { useI18n } from "../../i18n";
import { Button, Card, Chip, Note, Row, SelectControl, SettingRows, Stack, Tile } from "../../ui";
import { newestOf, written, type FunctionChoice, type FunctionVersions } from "./calcStepApi";

type FunctionCardProps = {
  functions: FunctionVersions[];
  chosen: FunctionChoice | null;
  onChange: (choice: FunctionChoice) => void;
};

const choicesOf = (functions: FunctionVersions[]): FunctionChoice[] =>
  functions.flatMap((entry) => entry.versions.map((version) => ({ name: entry.name, version })));

export function FunctionCard({ functions, chosen, onChange }: FunctionCardProps) {
  const { t } = useI18n();
  const choices = choicesOf(functions);
  const current = chosen ? functions.find((entry) => entry.name === chosen.name) : undefined;
  const newest = current ? newestOf(current) : 0;
  const newer = chosen && newest > chosen.version ? { name: chosen.name, version: newest } : null;
  const listed = choices.map((choice) => ({ value: written(choice), label: written(choice) }));
  const options = chosen ? listed : [{ value: "", label: t("calcstep.pickFunction") }, ...listed];
  const pick = (value: string) => {
    const found = choices.find((choice) => written(choice) === value);
    if (found) onChange(found);
  };
  return (
    <Card
      title={t("calcstep.function")}
      actions={chosen ? <Chip kind="mute">{t("calcstep.versionInUse").replace("{name}", written(chosen))}</Chip> : null}
    >
      <SettingRows
        rows={[
          {
            label: t("calcstep.function"),
            htmlFor: "calcstep-function",
            control: (
              <Stack gap={8}>
                <SelectControl
                  id="calcstep-function"
                  label={t("calcstep.function")}
                  value={chosen ? written(chosen) : ""}
                  options={options}
                  onChange={pick}
                />
                <Note>{current ? current.about : t("calcstep.noFunction")}</Note>
              </Stack>
            ),
          },
        ]}
      />
      {chosen && newer ? (
        <Row>
          <Tile
            state="warn"
            value={t("calcstep.newer").replace("{name}", written(newer))}
            label={t("calcstep.keepsCalling").replace("{name}", written(chosen))}
          />
          <Button kind="quiet" size="xs" onClick={() => onChange(newer)}>
            {t("calcstep.useVersion").replace("{version}", String(newer.version))}
          </Button>
        </Row>
      ) : null}
    </Card>
  );
}
