import { useId, useState, type ReactNode } from "react";
import { useI18n } from "../../i18n";
import { Button, Labelled, Row } from "../../ui";
import { Icon } from "../../ui/Icon";
import { KeyResult, type KeyLine } from "./KeyResult";

export type KeyFormState = {
  key: string;
  setKey: (key: string) => void;
  saved: boolean;
  saving: boolean;
  testing: boolean;
  line: KeyLine | null;
  save: () => unknown;
  test: () => unknown;
};

type Props = {
  form: KeyFormState;
  canSave: boolean;
  testable: boolean;
  label: string;
  placeholder: string;
  under: ReactNode;
  log?: ReactNode;
  off?: boolean;
  back?: ReactNode;
};

export function KeyForm({ form, canSave, testable, label, placeholder, under, log, off, back }: Props) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  const headingId = useId();
  const keyId = useId();

  return (
    <section className={off ? "panel mk-connect mk-off" : "panel mk-connect"} aria-labelledby={headingId}>
      <div className="mk-intro">
        <h2 id={headingId}>{t("models.connect")}</h2>
        <p>{t("models.keyPurpose")}</p>
        {off && <p className="mk-hold">{t("models.chooseProviderFirst")}</p>}
      </div>
      <Labelled id={keyId} label={label} required={false}>
        <div className="control mk-key">
          <Icon name="key" size={16} />
          <input
            id={keyId}
            type={shown ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            disabled={off}
            placeholder={placeholder}
            value={form.key}
            onChange={(e) => form.setKey(e.target.value)}
          />
          <button type="button" className="mk-reveal" aria-label={shown ? t("models.hideKey") : t("models.showKey")} disabled={off} onClick={() => setShown(!shown)}>
            <Icon name="eye" size={18} />
          </button>
        </div>
        {under}
      </Labelled>
      <Row>
        <Button type="button" kind={form.saved ? "quiet" : "primary"} disabled={off || !canSave || form.saving || form.saved} onClick={form.save}>
          {form.saved ? t("models.saved") : t("save")}
        </Button>
        <Button type="button" kind="quiet" disabled={off || !testable || form.testing || form.saving} onClick={form.test}>
          {t("models.testConnection")}
        </Button>
        <KeyResult line={form.line} />
        {back}
      </Row>
      {log}
    </section>
  );
}
