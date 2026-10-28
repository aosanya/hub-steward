import { useId } from "react";
import { useI18n } from "../../i18n";
import { OptionControl } from "../../ui/fieldControls";
import { chatLabelLimit } from "./ChatFields";
import { Labelled } from "../../ui";

type Props = {
  enabled: boolean;
  locked: boolean;
  label: string;
  placeholder: string;
  onEnabled: (enabled: boolean) => void;
  onLabel: (label: string) => void;
};

export function AddChatFields({ enabled, locked, label, placeholder, onEnabled, onLabel }: Props) {
  const { t } = useI18n();
  const titleId = useId();
  const nameId = useId();
  const usable = { value: "chat", label: t("models.chatUsable") };
  const off = locked || !enabled;

  return (
    <>
      <div className="field">
        <span className="field-label" id={titleId}>
          {t("chatTitle")}
        </span>
        <OptionControl name="chat" labelledBy={titleId} options={[usable]} off={locked} multiple isOn={() => enabled} onPick={() => onEnabled(!enabled)} />
      </div>
      <Labelled id={nameId} label={t("models.chatName")} required={false}>
        <span className={off ? "control ctl off" : "control ctl"}>
          <input id={nameId} type="text" value={label} maxLength={chatLabelLimit} placeholder={placeholder} disabled={off} onChange={(e) => onLabel(e.target.value)} />
        </span>
      </Labelled>
    </>
  );
}
