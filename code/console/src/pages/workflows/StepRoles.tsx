import { useState } from "react";
import type { Choice } from "../../data/pages/workflowDesign";
import { effectiveRoleId, loadStepAccountable, proposeClearAccountableRole, proposeSetAccountableRole } from "../../data/pages/stepRoles";
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
  const { state } = useLoaded(() => loadStepAccountable(hubId, stepId), [hubId, stepId]);
  const [roleId, setRoleId] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);

  const step = state.kind === "ready" ? state.value : { accountableRoleId: "", ownRoleId: "" };
  const shownRoleId = effectiveRoleId(step);
  const accountable = t("workflows.raci.accountable");

  const send = async (change: Promise<unknown>) => {
    setFailed(false);
    try {
      await change;
      setWaiting(true);
    } catch {
      setFailed(true);
    }
  };

  const set = () => send(proposeSetAccountableRole(hubId, stepId, stepName, roleId, nameOf(roles, roleId)).then(() => setRoleId("")));

  const removeText = t("workflows.removeStepRole").replace("{role}", nameOf(roles, step.accountableRoleId)).replace("{label}", accountable);
  const rows = shownRoleId
    ? [
        {
          key: shownRoleId,
          cells: [
            nameOf(roles, shownRoleId),
            step.accountableRoleId ? (
              <Button
                key="remove"
                kind="quiet"
                size="xs"
                icon="check"
                aria-label={removeText}
                title={removeText}
                onClick={() => send(proposeClearAccountableRole(hubId, stepId, stepName))}
              />
            ) : null,
          ],
        },
      ]
    : [];

  return (
    <Stack gap={12}>
      <h3>{t("workflows.roles")}</h3>
      {waiting ? <PendingNote /> : null}
      {failed || state.kind === "failed" ? <Empty text={t(failed ? "submitFailed" : "loadFailed")} failed /> : null}
      <DataTable columns={[t("roles.card"), accountable]} rows={rows} empty={t("workflows.noStepRoles")} />
      <Row gap={8}>
        <SelectControl
          id={"step-" + stepId + "-role"}
          label={t("roles.card")}
          value={roleId}
          options={[{ value: "", label: "" }, ...roles]}
          onChange={setRoleId}
        />
        <Button kind="quiet" size="sm" icon="plus" disabled={roleId === ""} onClick={set}>
          {t("workflows.addStepRole")}
        </Button>
      </Row>
    </Stack>
  );
}
