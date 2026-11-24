import { loadGenerated, slotsOf } from "../../data/pages/generatedWorkflows";
import { holderNames } from "../../data/pages/stepHolders";
import type { LiveRecord } from "../../data/pages/records";
import { useI18n } from "../../i18n";
import { useLoaded } from "../../shell/useLoaded";
import { Chip, DataTable, SectionHeading, Stack, TextLink } from "../../ui";
import { State, generatedPath } from "../workflows/GeneratedWorkflowsPage";

export function RecordWorkflows({ hubId, record }: { hubId: string; record: LiveRecord }) {
  const { t } = useI18n();
  const { state } = useLoaded(() => loadGenerated(hubId), [hubId, record.code]);
  if (state.kind !== "ready" || state.value.workflows.length === 0) return null;
  const set = state.value;
  const known = set.records.find((one) => one.code === record.code);
  if (!known) return null;

  return (
    <section>
      <Stack gap={8}>
        <SectionHeading title={t("generated.recordCard").replace("{record}", record.name)} />
        <DataTable
          columns={[t("workflows.action"), t("generated.heldBy"), t("colState")]}
          empty=""
          rows={slotsOf(set, known).map((slot) => ({
            key: slot.code,
            cells: [
              <Chip key="action" kind="mute">
                {t("generated.action." + slot.action)}
              </Chip>,
              holderNames(slot.workflow?.heldBy ?? slot.record.heldBy[slot.action]),
              slot.workflow ? <State key="state" hubId={hubId} workflow={slot.workflow} /> : <Chip key="state" kind="bad">{t("generated.missing")}</Chip>,
            ],
            actions: slot.workflow ? (
              <TextLink to={generatedPath(hubId, slot.workflow.id)} size="sm">
                {t("ui.open")}
              </TextLink>
            ) : undefined,
          }))}
        />
      </Stack>
    </section>
  );
}
