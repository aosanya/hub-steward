import { useState } from "react";
import { listHazards, type LibraryKind } from "../../data/pages/library";
import { useI18n } from "../../i18n";
import { Empty } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { FormCard, FormSelect, FormText, FormTextarea } from "../spec/goalsForm";
import { kindSetups, type LibraryEntry } from "./libraryKinds";

type LibraryPartFormProps = { hubId: string; kind: LibraryKind; existing?: LibraryEntry; onDone: () => void; onCancel: () => void };

export function LibraryPartForm({ hubId, kind, existing, onDone, onCancel }: LibraryPartFormProps) {
  const { t } = useI18n();
  const setup = kindSetups[kind];
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [hazardCode, setHazardCode] = useState(existing?.hazardCode ?? "");
  const withHazard = kind === "consequence";
  const hazards = useLoaded(() => (withHazard ? listHazards(hubId) : Promise.resolve([])), [hubId, withHazard]).state;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      setError(`${t("required")}: ${t("field.title")}`);
      return;
    }
    if (withHazard && !hazardCode) {
      setError(`${t("required")}: ${t("library.hazard")}`);
      return;
    }
    setError("");
    setBusy(true);
    const input = { title: title.trim(), description: description.trim(), ...(withHazard ? { hazardCode } : {}) };
    try {
      if (existing) await setup.update(hubId, existing.id, input);
      else await setup.create(hubId, input);
    } catch (failure) {
      setBusy(false);
      setError((failure instanceof Error && failure.message) || t("submitFailed"));
      return;
    }
    onDone();
  };

  if (withHazard && !existing && hazards.kind === "ready" && hazards.value.length === 0) return <Empty text={t("library.noHazardsYet")} />;

  const hazardOptions = [{ value: "", label: t("library.chooseHazard") }, ...(hazards.kind === "ready" ? hazards.value.map((hazard) => ({ value: hazard.code, label: `${hazard.code} ${hazard.title}` })) : [])];

  return (
    <FormCard title={t(existing ? setup.editKey : setup.addKey)} submit={t("save")} cancel={t("cancel")} note={t("library.saved")} error={error} busy={busy} onSubmit={submit} onCancel={onCancel}>
      {withHazard ? <FormSelect label={t("library.hazard")} value={hazardCode} options={hazardOptions} onChange={setHazardCode} /> : null}
      <FormText label={t("field.title")} value={title} onChange={setTitle} />
      <FormTextarea label={t("field.description")} value={description} onChange={setDescription} />
    </FormCard>
  );
}
