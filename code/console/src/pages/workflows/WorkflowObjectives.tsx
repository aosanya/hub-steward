import { useState } from "react";
import { hubPath } from "../../api";
import { objectiveName, proposeUnlinkObjective, type ObjectiveChoice } from "../../data/pages/workflows";
import type { ActionResult } from "../../data/types";
import { useI18n } from "../../i18n";
import type { FieldSpec } from "../../types";
import { Button, FormObject, Row, Stack, TextLink, type FormValues } from "../../ui";
import { textOf } from "../spec/usersRead";

type Link = Record<string, unknown>;

export const linkedIds = (links: Link[]): string[] => links.map((link) => textOf(link.objective_id));

export const unlinkedChoices = (choices: ObjectiveChoice[], links: Link[]): ObjectiveChoice[] => {
  const taken = new Set(linkedIds(links));
  return choices.filter((choice) => !taken.has(choice.id));
};

type LinesProps = {
  hubId: string;
  workflowName: string;
  links: Link[];
  choices: ObjectiveChoice[] | null;
  onChanged: (result: ActionResult) => void;
};

export function ObjectiveLines({ hubId, workflowName, links, choices, onChanged }: LinesProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (links.length === 0) return <span className="muted">{t("workflows.noObjective")}</span>;

  const unlink = async (link: Link, objective: ObjectiveChoice) => {
    setBusy(true);
    setFailed(false);
    try {
      onChanged(await proposeUnlinkObjective(hubId, textOf(link.id), workflowName, objective));
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  return (
    <Stack gap={8}>
      {links.map((link) => {
        const id = textOf(link.objective_id);
        const objective = choices?.find((choice) => choice.id === id) ?? { id, code: "", title: "" };
        return (
          <Row key={textOf(link.id) || id} gap={8}>
            <Stack gap={4}>
              <TextLink to={hubPath(hubId, "goals")} size="sm">
                {objective.code || objectiveName(objective)}
              </TextLink>
              {objective.code && objective.title ? <span className="muted">{objective.title}</span> : null}
            </Stack>
            <Button kind="quiet" size="sm" disabled={busy} onClick={() => unlink(link, objective)}>
              {t("workflows.unlinkObjective")}
            </Button>
          </Row>
        );
      })}
      {failed ? (
        <p className="field-error error" role="alert">
          {t("submitFailed")}
        </p>
      ) : null}
    </Stack>
  );
}

type LinkFormProps = { choices: ObjectiveChoice[]; onLink: (objective: ObjectiveChoice) => Promise<void>; onCancel: () => void };

export function LinkObjectiveForm({ choices, onLink, onCancel }: LinkFormProps) {
  const fields: FieldSpec[] = [
    { name: "objective_id", component: "select", required: true, options: choices.map((choice) => ({ value: choice.id, label: objectiveName(choice) })) },
  ];
  const submit = async (values: FormValues) => {
    const chosen = choices.find((choice) => choice.id === String(values.objective_id ?? ""));
    if (chosen) await onLink(chosen);
  };
  return <FormObject title="" fields={fields} onSubmit={submit} onCancel={onCancel} />;
}
