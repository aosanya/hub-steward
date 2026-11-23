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
  const addingRole = [{ value: "", label: t("workflows.addingRole") }];
  const none = [{ value: "", label: t("workflows.noneReplaced") }];
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
            <TextLabelled id={id + "-item"} label={t("workflows.itemName")} value={record.itemName} onChange={(itemName) => set({ itemName })} />
            <PickLabelled id={id + "-edit"} label={t("workflows.whoEdits")} value={record.editRoleId} options={[...addingRole, ...choices.roles]} onChange={(editRoleId) => set({ editRoleId })} />
            <PickLabelled id={id + "-delete"} label={t("workflows.whoDeletes")} value={record.deleteRoleId} options={[...addingRole, ...choices.roles]} onChange={(deleteRoleId) => set({ deleteRoleId })} />
            <PickLabelled id={id + "-add-by"} label={t("workflows.addReplacedBy")} value={record.addReplacedBy} options={[...none, ...choices.designed]} onChange={(addReplacedBy) => set({ addReplacedBy })} />
            <PickLabelled id={id + "-edit-by"} label={t("workflows.editReplacedBy")} value={record.editReplacedBy} options={[...none, ...choices.designed]} onChange={(editReplacedBy) => set({ editReplacedBy })} />
            <PickLabelled id={id + "-delete-by"} label={t("workflows.deleteReplacedBy")} value={record.deleteReplacedBy} options={[...none, ...choices.designed]} onChange={(deleteReplacedBy) => set({ deleteReplacedBy })} />
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
