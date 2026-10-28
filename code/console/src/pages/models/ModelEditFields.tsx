import { useId } from "react";
import { useI18n } from "../../i18n";
import { Labelled, TextControl } from "../../ui";
import { ReadonlyControl } from "../../ui/fieldControls";
import { providerName, type Provider } from "./catalog";
import { ModelPicker } from "./ModelPicker";
import type { KeyModels } from "./useKeyModels";

function Shown({ label, value }: { label: string; value: string }) {
  const id = useId();
  return (
    <Labelled id={id} label={label} required={false}>
      <ReadonlyControl attrs={{ id, name: id, disabled: false }} frame={{ bad: false, off: false }} value={value} />
    </Labelled>
  );
}

type Props = {
  provider: Provider;
  model: string;
  typedName: string;
  showsName: boolean;
  base: string;
  keyModels: KeyModels;
  onModel: (value: string) => void;
  onName: (value: string) => void;
};

export function ModelEditFields({ provider, model, typedName, showsName, base, keyModels, onModel, onName }: Props) {
  const { t } = useI18n();
  const modelId = useId();
  const nameId = useId();
  return (
    <>
      <Shown label={t("models.provider")} value={providerName(t, provider)} />
      <ModelPicker id={modelId} label={t("models.model")} provider={provider} value={model} keyModels={keyModels} required={false} onChange={onModel} />
      {showsName && (
        <Labelled id={nameId} label={t("models.modelName")} hint={provider.suggestsName ? t("models.nameHintHost") : undefined}>
          <TextControl id={nameId} value={typedName} onChange={onName} />
        </Labelled>
      )}
      {provider.baseEditable && <Shown label={t("models.baseAddress")} value={base} />}
    </>
  );
}
