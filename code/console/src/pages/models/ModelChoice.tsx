import { useId, type ReactNode } from "react";
import { useI18n } from "../../i18n";
import { Card, Labelled, SelectControl, Stack, TextControl } from "../../ui";
import { ModelPicker } from "./ModelPicker";
import { providerName, providers } from "./catalog";
import type { KeyModels } from "./useKeyModels";
import type { ModelChoiceState } from "./useModelChoice";

type Props = { state: ModelChoiceState; locked?: boolean; keyModels?: KeyModels; children?: ReactNode };

export function ModelChoice({ state, locked = false, keyModels, children }: Props) {
  const { t } = useI18n();
  const providerId = useId();
  const modelId = useId();
  const nameId = useId();
  const baseId = useId();
  const { provider } = state;
  const modelLocked = locked && keyModels?.phase !== "loaded" && keyModels?.phase !== "failed";
  const providerOptions = [{ value: "", label: t("models.chooseProvider") }, ...providers.map((p) => ({ value: p.id, label: providerName(t, p) }))];
  const baseHint = provider?.baseHint ? t(provider.baseHint) : undefined;
  const nameHint = provider?.suggestsName ? t("models.nameHintHost") : undefined;
  const baseError = state.baseRefused ? t("models.baseAddressHttps") : undefined;

  return (
    <Card>
      <Stack gap={18}>
        <Labelled id={providerId} label={t("models.provider")}>
          <SelectControl id={providerId} value={provider?.id ?? ""} options={providerOptions} disabled={locked} onChange={state.setProvider} />
        </Labelled>
        <ModelPicker id={modelId} label={t("models.model")} provider={provider} value={state.model} keyModels={keyModels} disabled={modelLocked} onChange={state.setModel} />
        {state.showsName && (
          <Labelled id={nameId} label={t("models.modelName")} hint={nameHint}>
            <TextControl id={nameId} value={state.typedName} disabled={modelLocked} onChange={state.setName} />
          </Labelled>
        )}
        {provider?.baseEditable && (
          <Labelled id={baseId} label={t("models.baseAddress")} hint={baseHint} error={baseError}>
            <TextControl id={baseId} value={state.typedBase} placeholder="https://" disabled={locked} onChange={state.setBase} />
          </Labelled>
        )}
        {children}
      </Stack>
    </Card>
  );
}
