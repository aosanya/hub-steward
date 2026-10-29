import type { SlotAnswer } from "../data/chatAnswer";
import { useI18n } from "../i18n";
import { DataTable, FromChat } from "../ui";
import { ActionSlot } from "./ActionSlot";
import { useConsole } from "./context";

type AnswerSlotProps = { answer: SlotAnswer | null; onClear: () => void };

export function AnswerSlot({ answer, onClear }: AnswerSlotProps) {
  const { t } = useI18n();
  const { hub } = useConsole();
  if (!answer) return null;
  if (answer.kind === "action") return <ActionSlot hubId={hub.id} answer={answer} onClear={onClear} />;
  const areaLabel = (area: string) => {
    const key = `chat.area.${area}`;
    const label = t(key);
    return label === key ? area : label;
  };
  const rows = answer.rows.map((row) => ({ key: row.name, cells: [<code key="name">{row.name}</code>, row.summary, areaLabel(row.area)] }));
  return (
    <div className="content answer-slot">
      <FromChat prompt={answer.prompt} onClear={onClear}>
        <DataTable columns={[t("chat.colTool"), t("chat.colDoes"), t("chat.colArea")]} rows={rows} empty={t("noRows")} />
      </FromChat>
    </div>
  );
}
