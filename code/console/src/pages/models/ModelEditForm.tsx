import { useId } from "react";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Button, Row, Stack } from "../../ui";
import { providerName } from "./catalog";
import { ChatFields } from "./ChatFields";
import { ModelEditFields } from "./ModelEditFields";
import { ModelEditKey } from "./ModelEditKey";
import { TestLog } from "./TestLog";
import { useEditModel, type Editable } from "./useEditModel";
import { useKeyModels } from "./useKeyModels";

export function ModelEditForm({ held, onSaved }: { held: Editable; onSaved: () => void }) {
  const { t } = useI18n();
  const headingId = useId();
  const edit = useEditModel(held, onSaved);
  const { hub } = useConsole();
  const keyModels = useKeyModels(hub.id, held.account.id, edit.keySet);

  return (
    <section className="panel mk-connect" aria-labelledby={headingId}>
      <div className="mk-intro">
        <h2 id={headingId}>{t("models.connect")}</h2>
        <p>{t("models.keyPurpose")}</p>
      </div>
      <Stack>
        <ModelEditFields
          provider={edit.provider}
          model={edit.model}
          typedName={edit.typedName}
          showsName={edit.showsName}
          base={held.account.baseUrl}
          keyModels={keyModels}
          onModel={edit.setModel}
          onName={edit.setTypedName}
        />
        <ChatFields
          enabled={edit.chatEnabled}
          locked={held.chatLocked}
          label={edit.chatLabel}
          placeholder={edit.chatLabelHint}
          onEnabled={edit.setChatEnabled}
          onLabel={edit.setChatLabel}
        />
      </Stack>
      <ModelEditKey edit={edit} />
      <Row>
        {edit.dirty && (
          <>
            <Button type="button" kind="primary" disabled={!edit.canSave} onClick={edit.save}>
              {t("save")}
            </Button>
            <Button type="button" kind="quiet" disabled={edit.saving} onClick={edit.cancel}>
              {t("models.cancel")}
            </Button>
          </>
        )}
        <Button type="button" kind="quiet" disabled={!(edit.keySet || edit.keyTyped) || edit.busy} onClick={edit.test}>
          {t("models.testConnection")}
        </Button>
      </Row>
      <TestLog run={edit.log} provider={providerName(t, edit.provider)} />
    </section>
  );
}
