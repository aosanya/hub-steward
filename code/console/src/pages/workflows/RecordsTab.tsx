import { emptyRecord, type DesignChoices, type RecordDraft } from "../../data/pages/workflowDesign";
import { useI18n } from "../../i18n";
import { Button, Card, Empty, Stack } from "../../ui";
import { PickLabelled, TextLabelled, replaced, without } from "./editParts";
import { QuestionCards } from "./QuestionCards";

type Props = {
  records: RecordDraft[];
  choices: DesignChoices;
  onChange: (records: RecordDraft[]) => void;
};

export function RecordsTab({ records, choices, onChange }: Props) {
  const { t } = useI18n();
  const addButton = (
    <Button kind="quiet" size="sm" icon="plus" onClick={() => onChange([...records, emptyRecord()])}>
      {t("workflows.addRecord")}
    </Button>
  );

  return (
    <Stack gap={12}>
      {records.length === 0 ? <Empty text={t("workflows.noRecords")} action={addButton} /> : <div>{addButton}</div>}
      {records.map((record, index) => {
        const id = "record-" + record.key;
        const set = (change: Partial<RecordDraft>) => onChange(replaced(records, index, { ...record, ...change }));
        return (
          <Card key={record.key} title={`${index + 1} · ${record.name}`}>
            <TextLabelled id={id + "-name"} label={t("field.name")} value={record.name} onChange={(name) => set({ name })} />
            <PickLabelled
              id={id + "-role"}
              label={t("workflows.whoAdds")}
              value={record.roleId}
              options={[{ value: "", label: "" }, ...choices.roles]}
              onChange={(roleId) => set({ roleId })}
            />
            <PickLabelled
              id={id + "-viewer"}
              label={t("workflows.whoSees")}
              value={record.viewerRoleId}
              options={[{ value: "", label: "" }, ...choices.roles]}
              onChange={(viewerRoleId) => set({ viewerRoleId })}
            />
            <QuestionCards
              id={id}
              questions={record.questions}
              lists={choices.lists}
              answerTypes={choices.answerTypes}
              onChange={(questions) => set({ questions })}
            />
            <div>
              <Button kind="quiet" size="sm" onClick={() => onChange(without(records, index))}>
                {t("workflows.removeRecord")}
              </Button>
            </div>
          </Card>
        );
      })}
    </Stack>
  );
}
