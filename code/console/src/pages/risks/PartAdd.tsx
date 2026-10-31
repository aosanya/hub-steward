import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import type { Part } from "../../data/pages/risks";
import { listConsequences } from "../../data/pages/library";
import { Button, Labelled } from "../../ui";
import { FormCard, FormSelect, FormText } from "../spec/goalsForm";
import { createPart, linkPart, type PartSide } from "./riskAddWrite";

type PartAddProps = { hubId: string; riskCode: string; side: PartSide; hazardCode: string; library: Part[]; linked: Part[]; onSaved: () => void };

const NEW = "";

export function PartAdd({ hubId, riskCode, side, hazardCode, library, linked, onSaved }: PartAddProps) {
  const { t } = useI18n();
  const label = t(side === "threat" ? "risks.addThreat" : "risks.addConsequence");
  const [hazardOf, setHazardOf] = useState<Record<string, string>>({});
  const needsHazard = side === "consequence";
  const blocked = needsHazard && hazardCode === "";
  const available = library.filter(
    (part) => !linked.some((one) => one.code === part.code) && (!needsHazard || (hazardCode !== "" && hazardOf[part.code] === hazardCode)),
  );
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const picked = chosen ?? available[0]?.code ?? NEW;

  useEffect(() => {
    if (!needsHazard) return;
    let live = true;
    listConsequences(hubId)
      .then((parts) => live && setHazardOf(Object.fromEntries(parts.map((part) => [part.code, part.hazardCode ?? ""]))))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [hubId, needsHazard]);

  const close = () => {
    setOpen(false);
    setChosen(null);
    setTitle("");
    setDescription("");
    setError("");
  };

  const submit = async () => {
    if (blocked) {
      setError(t("library.pickHazardFirst"));
      return;
    }
    if (picked === NEW && !title.trim()) {
      setError(`${t("required")}: ${t("field.title")}`);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const code = picked === NEW ? await createPart(hubId, side, { title, description, hazardCode }) : picked;
      await linkPart(hubId, riskCode, side, code);
    } catch {
      setBusy(false);
      setError(t("submitFailed"));
      return;
    }
    setBusy(false);
    close();
    onSaved();
  };

  if (!open) {
    return (
      <Button kind="quiet" size="sm" icon="plus" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }
  return (
    <FormCard title={label} submit={t("save")} cancel={t("cancel")} note={t("risks.saved")} error={error} busy={busy} onSubmit={submit} onCancel={close}>
      {blocked ? (
        <Labelled id="part-add-blocked" label={t("risks.library")} required={false}>
          <span className="control">
            <select id="part-add-blocked" disabled value="">
              <option value="">{t("library.pickHazardFirst")}</option>
            </select>
          </span>
        </Labelled>
      ) : (
        <FormSelect
          label={t("risks.library")}
          value={picked}
          options={[...available.map((part) => ({ value: part.code, label: part.title })), { value: NEW, label: t("risks.createNew") }]}
          onChange={setChosen}
        />
      )}
      {!blocked && picked === NEW ? (
        <>
          <FormText label={t("field.title")} value={title} onChange={setTitle} />
          <FormText label={t("field.description")} value={description} onChange={setDescription} />
        </>
      ) : null}
    </FormCard>
  );
}
