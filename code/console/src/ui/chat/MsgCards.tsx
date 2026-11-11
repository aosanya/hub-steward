import { useI18n } from "../../i18n";
import { Button } from "../Button";
import { Card } from "../Card";
import { Icon } from "../Icon";
import type { MsgActionProps, MsgChoiceProps, MsgConfirmProps, MsgErrorProps, MsgSuggestionProps } from "../props";
import { msgButtonItems } from "./MsgButtons";
import { MsgCard } from "./MsgCard";

export function MsgChoice({ question, options, picked, onPick }: MsgChoiceProps) {
  return (
    <MsgCard icon="chat" title={question}>
      <div className="msg-buttons">
        {options.map((option) =>
          option === picked ? (
            <Button key={option} size="sm" aria-pressed>
              {option}
            </Button>
          ) : (
            <Button key={option} kind="quiet" size="sm" disabled={picked !== undefined} onClick={() => onPick?.(option)}>
              {option}
            </Button>
          ),
        )}
      </div>
    </MsgCard>
  );
}

export function MsgConfirm({ title, detail, confirm, cancel, danger, resolved, onConfirm, onCancel }: MsgConfirmProps) {
  const { t } = useI18n();
  const footer =
    resolved === undefined
      ? [
          <Button key="confirm" kind={danger ? "danger" : "primary"} size="sm" onClick={onConfirm}>
            {confirm ?? t("approve")}
          </Button>,
          <Button key="cancel" kind="quiet" size="sm" onClick={onCancel}>
            {cancel ?? t("cancel")}
          </Button>,
        ]
      : undefined;
  return (
    <MsgCard icon={danger ? "alert" : "check"} title={title} footer={footer}>
      <div className="msg-detail">{detail}</div>
      {resolved === "confirmed" ? (
        <div className="msg-done">
          <Icon name="check" size={16} stroke={2.6} />
          {t("ui.confirmed")}
        </div>
      ) : resolved === "cancelled" ? (
        <div className="msg-note">{t("ui.cancelledNothing")}</div>
      ) : (
        <div className="msg-note">{t("ui.nothingRecorded")}</div>
      )}
    </MsgCard>
  );
}

export function MsgError({ children }: MsgErrorProps) {
  return (
    <Card className="msg-card bad">
      <div className="msg-title bad">
        <Icon name="alert" size={16} />
        {children}
      </div>
    </Card>
  );
}

export function MsgSuggestion({ text, actions }: MsgSuggestionProps) {
  const { t } = useI18n();
  return (
    <MsgCard icon="sparkle" title={t("ui.suggestedNextStep")} footer={msgButtonItems(actions)}>
      <div className="msg-detail">{text}</div>
    </MsgCard>
  );
}

export function MsgAction({ title, detail, buttons = [], state }: MsgActionProps) {
  const { t } = useI18n();
  const done = state === "done";
  return (
    <MsgCard icon={done ? "check" : "wrench"} stroke={done ? 2.6 : undefined} tone={done ? "ok" : undefined} title={title} footer={msgButtonItems(buttons)}>
      {detail ? <div className="msg-detail">{detail}</div> : null}
      {state === "pending" ? <div className="msg-note">{t("ui.nothingRecorded")}</div> : null}
    </MsgCard>
  );
}
