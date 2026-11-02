import type { ActionAnswer } from "../data/chatAnswer";
import { useI18n } from "../i18n";
import { Empty, FromChat } from "../ui";
import { actionViewOf } from "./actionViews";

type ActionSlotProps = { hubId: string; answer: ActionAnswer; onClear: () => void };

export function ActionSlot({ hubId, answer, onClear }: ActionSlotProps) {
  const { t } = useI18n();
  const View = actionViewOf(answer.view);
  return (
    <div className="content answer-slot">
      <FromChat prompt={answer.prompt} onClear={onClear}>
        {View ? <View hubId={hubId} title={answer.title} params={answer.params} onDone={onClear} /> : <Empty text={t("loadFailed")} failed />}
      </FromChat>
    </div>
  );
}
