import { useId, useState } from "react";
import { useI18n } from "../../i18n";
import { Labelled } from "../../ui";
import { Icon } from "../../ui/Icon";
import type { EditModel } from "./useEditModel";

export function ModelEditKey({ edit }: { edit: EditModel }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  const keyId = useId();

  return (
    <Labelled id={keyId} label={t("models.keyReplace")} required={false}>
      <div className="control mk-key">
        <Icon name="key" size={16} />
        <input
          id={keyId}
          type={shown ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          placeholder={t(edit.provider.pasteKey)}
          value={edit.key}
          onChange={(e) => edit.setKey(e.target.value)}
        />
        <button type="button" className="mk-reveal" aria-label={shown ? t("models.hideKey") : t("models.showKey")} onClick={() => setShown(!shown)}>
          <Icon name="eye" size={18} />
        </button>
      </div>
      <span className="muted">{t("models.keyNeverShown")}</span>
    </Labelled>
  );
}
