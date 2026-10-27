import { useI18n } from "../i18n";
import { MsgAction } from "./chat/MsgCards";
import type { ActionCardProps, MsgButtonData } from "./props";

export function ActionCard({ title, text, state, buttons, onApprove, onDecline }: ActionCardProps) {
  const { t } = useI18n();
  const choices: MsgButtonData[] = buttons ?? [
    { label: t("approve"), kind: "primary", onClick: onApprove },
    { label: t("decline"), kind: "quiet", onClick: onDecline },
  ];
  return <MsgAction title={title} detail={text} buttons={choices} state={state} />;
}
