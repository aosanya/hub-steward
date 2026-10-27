import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Button, Stack, TextLink, TitleRow } from "../../ui";
import { AddChatFields } from "./AddChatFields";
import { firstAddStart, modelNameOf, providerName, type AddStart } from "./catalog";
import { KeyForm, type KeyFormState } from "./KeyForm";
import { ModelChoice } from "./ModelChoice";
import { TestLog } from "./TestLog";
import { useAddModel } from "./useAddModel";
import { useKeyModels } from "./useKeyModels";
import { useModelChoice } from "./useModelChoice";

export function ModelAdd({ onBack, start }: { onBack?: () => void; start?: AddStart }) {
  const { t } = useI18n();
  const state = useModelChoice(start ?? firstAddStart());
  const { provider } = state;
  const ownName = provider && state.choice.name ? modelNameOf(provider, state.choice.name) : "";
  const form = useAddModel(ownName);
  const { hub } = useConsole();
  const keyModels = useKeyModels(hub.id, form.account?.id, form.keyHeld);
  const modelId = state.choice.name ?? provider?.defaultName ?? "";
  const modelChanged = form.account !== null && state.complete && modelId !== form.account.modelName;
  const keyForm: KeyFormState = { ...form, save: () => form.save(state.choice) };
  const canSave = form.added ? form.key.trim() !== "" : state.complete;
  const findKey = !provider ? (
    <span className="link sm">{t("models.findKey")}</span>
  ) : provider.keyPage === "" ? null : (
    <a className="link sm" href={provider.keyPage} target="_blank" rel="noreferrer noopener">
      {t("models.findKey")}
    </a>
  );

  return (
    <>
      <TitleRow title={t("models.addModel")} />
      <div className="content">
        <Stack gap={24}>
          <ModelChoice state={state} locked={form.added} keyModels={keyModels}>
            <AddChatFields
              enabled={form.chatEnabled}
              locked={form.added}
              label={form.chatLabel}
              placeholder={ownName}
              onEnabled={form.setChatEnabled}
              onLabel={form.setChatLabel}
            />
          </ModelChoice>
          <KeyForm
            form={keyForm}
            canSave={canSave}
            testable={form.keyHeld}
            label={provider ? t(provider.keyLabel) : t("models.keyField")}
            placeholder={t(provider?.pasteKey ?? "models.paste")}
            under={findKey}
            log={<TestLog run={form.run} provider={provider ? providerName(t, provider) : ""} />}
            off={!provider}
            back={
              form.added ? (
                <>
                  {modelChanged && (
                    <Button type="button" kind="primary" disabled={form.saving} onClick={() => form.changeModel(state.choice)}>
                      {t("models.saveModel")}
                    </Button>
                  )}
                  <TextLink onClick={onBack}>{t("models.backToModels")}</TextLink>
                </>
              ) : null
            }
          />
        </Stack>
      </div>
    </>
  );
}
