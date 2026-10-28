import { useI18n } from "../../i18n";
import { Labelled, TextLink } from "../../ui";
import { Icon } from "../../ui/Icon";
import { modelMenu, otherModel, providerName, type ModelOption, type Provider } from "./catalog";
import type { KeyModels } from "./useKeyModels";

type Props = {
  id: string;
  label: string;
  provider: Provider | undefined;
  value: string;
  keyModels?: KeyModels;
  inUse?: (id: string) => boolean;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function ModelPicker({ id, label, provider, value, keyModels, inUse, required, disabled, onChange }: Props) {
  const { t } = useI18n();
  const phase = keyModels?.phase ?? "waiting";
  const listed = phase === "loaded" ? (keyModels?.names ?? []) : [];
  const menu = provider ? modelMenu(provider, listed, value) : { current: [], fromKey: [], standard: [] };
  const asked = !provider || provider.models.length > 0;
  const loading = phase === "loading";
  const off = !provider || disabled === true || loading;
  const named = provider ? providerName(t, provider) : "";
  const shown = (option: ModelOption) => (inUse?.(option.value) ? `${option.label} · ${t("models.inUse")}` : option.label);
  const option = (o: ModelOption) => (
    <option key={o.value} value={o.value}>
      {shown(o)}
    </option>
  );
  const hint =
    provider && phase === "waiting" && keyModels ? (
      t("models.saveToSee")
    ) : phase === "loaded" ? (
      <TextLink onClick={keyModels?.reload}>{t("models.refresh")}</TextLink>
    ) : phase === "failed" ? (
      <>
        {t("models.listFailed").replace("{provider}", named)} <TextLink onClick={keyModels?.reload}>{t("retry")}</TextLink>
      </>
    ) : undefined;

  return (
    <Labelled id={id} label={label} required={required} hint={hint}>
      <span className={off ? "control ctl off" : "control ctl"}>
        <select id={id} value={loading ? "" : value} disabled={off} onChange={(e) => onChange(e.target.value)}>
          {loading ? (
            <option value="">{t("models.loadingFrom").replace("{provider}", named)}</option>
          ) : (
            <>
              {asked && <option value="">{t("models.choose")}</option>}
              {menu.current.map(option)}
              {menu.fromKey.length > 0 && <optgroup label={t("models.fromKey")}>{menu.fromKey.map(option)}</optgroup>}
              {menu.standard.map(option)}
              {provider && <option value={otherModel}>{t("models.otherModel")}</option>}
            </>
          )}
        </select>
        <Icon name="chevron" size={16} />
      </span>
    </Labelled>
  );
}
