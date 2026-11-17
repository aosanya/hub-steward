import { useMemo } from "react";
import { addRow, answersOf, fieldsOf, type LiveRecord } from "../../data/pages/records";
import { useI18n } from "../../i18n";
import { FormObject, type FormValues } from "../../ui";

type RecordRowFormProps = { hubId: string; record: LiveRecord; onAdded: () => void; onCancel: () => void };

export function RecordRowForm({ hubId, record, onAdded, onCancel }: RecordRowFormProps) {
  const { t } = useI18n();
  const fields = useMemo(() => fieldsOf(record.questions), [record]);
  const submit = async (values: FormValues) => {
    try {
      await addRow(hubId, record.code, answersOf(fields, values));
    } catch {
      return t("submitFailed");
    }
    onAdded();
  };
  return <FormObject title="" fields={fields} onSubmit={submit} onCancel={onCancel} />;
}
