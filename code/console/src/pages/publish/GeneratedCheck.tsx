import { Link } from "react-router-dom";
import { hubPath } from "../../api";
import type { RecordSlot } from "../../data/pages/generatedWorkflows";
import { useI18n } from "../../i18n";
import { Cell, Chip, DataTable, SectionTitle, Stack, TextLink } from "../../ui";
import { generatedPath, recordPath } from "../workflows/GeneratedWorkflowsPage";
import { missingSlots, type PublishState } from "./publishData";

type Props = { hubId: string; state: PublishState; rows: RecordSlot[][] };

function Slot({ hubId, slot }: { hubId: string; slot: RecordSlot }) {
  const { t } = useI18n();
  if (!slot.workflow) return <Chip kind="bad">{t("generated.missingCode").replace("{code}", slot.code)}</Chip>;
  return (
    <Link className="cell-name" to={generatedPath(hubId, slot.workflow.id)}>
      <Chip kind="ok">{slot.code}</Chip>
    </Link>
  );
}

export function GeneratedCheck({ hubId, state, rows }: Props) {
  const { t } = useI18n();
  const total = rows.length * 3;
  const present = total - missingSlots(state).length;
  return (
    <section>
      <Stack gap={8}>
        <SectionTitle title={t("publish.generated")} right={<span className="count">{t("publish.generatedCount").replace("{n}", String(present)).replace("{total}", String(total))}</span>} />
        <p className="soft">{t("publish.generatedNote")}</p>
        <DataTable
          columns={[t("test.colRecord"), t("generated.action.add"), t("generated.action.edit"), t("generated.action.delete")]}
          empty=""
          rows={rows.map((slots) => ({
            key: slots[0].record.code,
            cells: [
              <Cell key="record" text={slots[0].record.name} sub={slots[0].record.code} />,
              ...slots.map((slot) => <Slot key={slot.code} hubId={hubId} slot={slot} />),
            ],
            actions: (
              <TextLink to={recordPath(hubId, slots[0].record.code)} size="sm">
                {t("generated.openRecord")}
              </TextLink>
            ),
          }))}
        />
      </Stack>
    </section>
  );
}
