import { useState } from "react";
import { useI18n } from "../../i18n";
import { Button, Card, Cell, DataTable, IconButton, Note } from "../../ui";
import { FormSelect } from "../spec/goalsForm";
import { useLoaded } from "../../shell/useLoaded";
import { attachPart, detachPart, loadAttachments } from "./attachmentWrites";

export function ControlAttachments({ hubId, controlId }: { hubId: string; controlId: string }) {
  const { t } = useI18n();
  const { state, reload } = useLoaded(() => loadAttachments(hubId, controlId), [hubId, controlId]);
  const [picked, setPicked] = useState("");
  const [problem, setProblem] = useState("");

  if (state.kind !== "ready") return null;
  const { attached, choices } = state.value;
  const word = (kind: string) => t(kind === "threat" ? "risks.threat" : "risks.consequence");

  const run = async (write: () => Promise<void>) => {
    setProblem("");
    try {
      await write();
      setPicked("");
      reload();
    } catch {
      setProblem(t("submitFailed"));
    }
  };

  const add = () => {
    const choice = choices.find((one) => one.value === picked);
    if (choice) run(() => attachPart(hubId, controlId, choice));
  };

  const options = [
    { value: "", label: t("controls.attachPick") },
    ...choices.map((one) => ({ value: one.value, label: `${word(one.kind)} · ${one.title}` })),
  ];

  return (
    <Card title={t("controls.attachedTo")}>
      {attached.length > 1 ? <Note>{t("controls.attachMany")}</Note> : null}
      <DataTable
        columns={[t("controls.attachedTo")]}
        empty={t("noRows")}
        rows={attached.map((one) => ({
          key: one.id,
          cells: [<Cell key="part" text={one.title} sub={word(one.kind)} />],
          actions: <IconButton icon="cross" label={t("controls.detach")} onClick={() => run(() => detachPart(hubId, one.id))} />,
        }))}
      />
      <FormSelect label={t("controls.attachPick")} value={picked} options={options} onChange={setPicked} />
      {problem ? (
        <p className="field-error error" role="alert">
          {problem}
        </p>
      ) : null}
      <Button kind="quiet" size="sm" disabled={picked === ""} onClick={add}>
        {t("controls.attachAdd")}
      </Button>
    </Card>
  );
}
