import { useI18n } from "../../i18n";
import { Chip } from "../Chip";
import { Icon } from "../Icon";
import type { MsgFormProps, MsgRefProps } from "../props";
import { msgButtonItems } from "./MsgButtons";
import { MsgCard } from "./MsgCard";

type Pointer = { icon: string; title: string; count: string; nav?: MsgRefProps["nav"] };

function Pointer({ icon, title, count, nav }: Pointer) {
  const { t } = useI18n();
  return (
    <MsgCard
      icon={icon}
      className="msg-ref"
      footer={nav ? msgButtonItems([nav]) : undefined}
      title={
        <>
          <span className="ref-title">{title}</span>
          <Chip kind="mute">{count}</Chip>
        </>
      }
    >
      <div className="msg-note ref-go">
        <Icon name="arrow-left" size={12} stroke={2.4} />
        {t("ui.shownInContent")}
      </div>
    </MsgCard>
  );
}

function useCount() {
  const { t } = useI18n();
  return (n: number, one: string, many: string) => t(n === 1 ? one : many).replace("{n}", String(n));
}

export function MsgList({ title, count, nav }: MsgRefProps) {
  const counted = useCount();
  return <Pointer icon="filter" title={title} count={counted(count, "ui.resultOne", "ui.resultMany")} nav={nav} />;
}

export function MsgRows({ title, count }: MsgRefProps) {
  const counted = useCount();
  return <Pointer icon="clipboard" title={title} count={counted(count, "ui.rowOne", "ui.rowMany")} />;
}

export function MsgResult({ title, count }: MsgRefProps) {
  const counted = useCount();
  return <Pointer icon="check" title={title} count={counted(count, "ui.itemOne", "ui.itemMany")} />;
}

export function MsgEdit({ title }: MsgFormProps) {
  const { t } = useI18n();
  return <Pointer icon="edit" title={title} count={t("ui.form")} />;
}

export function MsgForm({ title }: MsgFormProps) {
  const { t } = useI18n();
  return <Pointer icon="edit" title={title} count={t("ui.form")} />;
}
