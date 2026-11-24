import { useI18n } from "../i18n";
import { Button, Empty } from "../ui";
import { EntryScreen } from "./EntryScreen";

type NoGroupProps = { onCheck: () => void; onLeave: () => void };

export function NoGroup({ onCheck, onLeave }: NoGroupProps) {
  const { t } = useI18n();
  return (
    <EntryScreen onSignOut={onLeave}>
      <div className="ent-list">
        <h1>{t("groupChoose")}</h1>
        <Empty text={t("groupNone")} action={<Button onClick={onCheck}>{t("groupCheckAgain")}</Button>} />
      </div>
    </EntryScreen>
  );
}
