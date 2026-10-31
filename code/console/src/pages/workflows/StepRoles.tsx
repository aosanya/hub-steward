import { useState } from "react";
import type { Choice } from "../../data/pages/workflowDesign";
import {
  loadStepAssignments,
  proposeAddStepRole,
  proposeRemoveStepRole,
  raciLabels,
  rowsOfStep,
  type RaciLabel,
  type StepAssignment,
} from "../../data/pages/stepRoles";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Button, DataTable, Empty, Row, SelectControl, Stack } from "../../ui";
import { PendingNote } from "../spec/usersParts";
import { useLoaded } from "../../shell/useLoaded";

type Props = { stepId: string; stepName: string; roles: Choice[] };

const nameOf = (roles: Choice[], id: string) => roles.find((role) => role.value === id)?.label ?? id;

export function StepRoles({ stepId, stepName, roles }: Props) {
  const { t } = useI18n();
  const { hub } = useConsole();
  const hubId = hub.id;
  const { state } = useLoaded(() => loadStepAssignments(hubId, stepId), [hubId, stepId]);
  const [roleId, setRoleId] = useState("");
  const [label, setLabel] = useState<RaciLabel>("responsible");
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);

  const assignments: StepAssignment[] = state.kind === "ready" ? state.value : [];
  const labelWord = (word: RaciLabel) => t("workflows.raci." + word);
  const taken = assignments.some((assignment) => assignment.roleId === roleId && assignment.label === label);

  const send = async (change: Promise<unknown>) => {
    setFailed(false);
    try {
      await change;
      setWaiting(true);
    } catch {
      setFailed(true);
    }
  };

  const add = () => send(proposeAddStepRole(hubId, stepId, stepName, roleId, nameOf(roles, roleId), label).then(() => setRoleId("")));

  const rows = rowsOfStep(assignments).map((row) => ({
    key: row.roleId,
    cells: [
      nameOf(roles, row.roleId),
      ...raciLabels.map((word) => {
        const assignmentId = row.assignments[word];
        if (!assignmentId) return null;
        const text = t("workflows.removeStepRole").replace("{role}", nameOf(roles, row.roleId)).replace("{label}", labelWord(word));
        return (
          <Button
            key={word}
            kind="quiet"
            size="xs"
            icon="check"
            aria-label={text}
            title={text}
            onClick={() => send(proposeRemoveStepRole(hubId, assignmentId, stepName, nameOf(roles, row.roleId), word))}
          />
        );
      }),
    ],
  }));

  return (
    <Stack gap={12}>
      <h3>{t("workflows.roles")}</h3>
      {waiting ? <PendingNote /> : null}
      {failed || state.kind === "failed" ? <Empty text={t(failed ? "submitFailed" : "loadFailed")} failed /> : null}
      <DataTable columns={[t("roles.card"), ...raciLabels.map(labelWord)]} rows={rows} empty={t("workflows.noStepRoles")} />
      <Row gap={8}>
        <SelectControl
          id={"step-" + stepId + "-role"}
          label={t("roles.card")}
          value={roleId}
          options={[{ value: "", label: "" }, ...roles]}
          onChange={setRoleId}
        />
        <SelectControl
          id={"step-" + stepId + "-label"}
          label={t("workflows.raciLabel")}
          value={label}
          options={raciLabels.map((word) => ({ value: word, label: labelWord(word) }))}
          onChange={(value) => setLabel(value as RaciLabel)}
        />
        <Button kind="quiet" size="sm" icon="plus" disabled={roleId === "" || taken} onClick={add}>
          {t("workflows.addStepRole")}
        </Button>
      </Row>
    </Stack>
  );
}
