import { useEffect, useId, useState } from "react";
import { useI18n } from "../../i18n";
import type { OptionItem } from "../../types";
import { FileControl } from "../../ui/fieldControls";
import { languageName } from "./generalLanguages";
import { FormCard, FormSelect, FormText, FormTextarea } from "./goalsForm";
import { pickerOptions } from "./pickerOptions";
import { sendAction, type Outcome } from "./sendAction";

type UploadFormProps = { hubId: string; onOutcome: (result: Outcome) => void; onCancel: () => void };

export const readText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

const withoutExtension = (name: string) => name.replace(/\.[^.]+$/, "");

export function UploadForm({ hubId, onOutcome, onCancel }: UploadFormProps) {
  const { t } = useI18n();
  const fileId = useId();
  const fileLabel = useId();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("");
  const [text, setText] = useState("");
  const [languages, setLanguages] = useState<OptionItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    pickerOptions("general", hubId).then((options) => {
      if (!current) return;
      setLanguages(options.map((option) => ({ value: option.value, label: languageName(option.value) })));
      setLanguage((chosen) => chosen || options[0]?.value || "");
    });
    return () => {
      current = false;
    };
  }, [hubId]);

  const choose = async (chosen: File | null) => {
    setFile(chosen);
    if (!chosen) return;
    setTitle((typed) => typed || withoutExtension(chosen.name));
    try {
      setText(await readText(chosen));
    } catch {
      setError(t("submitFailed"));
    }
  };

  const submit = async () => {
    const missing = [!title.trim() ? t("field.title") : "", !text.trim() ? t("field.text") : ""].filter(Boolean);
    if (missing.length > 0) {
      setError(`${t("required")}: ${missing.join(", ")}`);
      return;
    }
    setError("");
    setBusy(true);
    const result = await sendAction("documents", "documents", hubId, { title, language, text });
    setBusy(false);
    if (result === "failed") {
      setError(t("submitFailed"));
      return;
    }
    onOutcome(result);
  };

  return (
    <FormCard
      title={t("documents.upload")}
      submit={t("documents.submit")}
      cancel={t("cancel")}
      note={t("documents.note")}
      error={error}
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <div className="field" role="group" aria-labelledby={fileLabel}>
        <span className="field-label" id={fileLabel}>
          {t("documents.file")}
        </span>
        <FileControl
          attrs={{ id: fileId, name: "file", disabled: false }}
          frame={{ bad: false, off: false }}
          value={file}
          onChange={choose}
        />
      </div>
      <FormText label={t("field.title")} value={title} onChange={setTitle} />
      <FormSelect label={t("field.language")} value={language} options={languages} onChange={setLanguage} />
      <FormTextarea label={t("field.text")} value={text} onChange={setText} />
    </FormCard>
  );
}
