import { useI18n } from "../../i18n";
import { Chip } from "../../ui";
import { providerName, type Provider } from "./catalog";

export function BrandChip({ provider }: { provider: Provider }) {
  const { t } = useI18n();
  return provider.brand ? <Chip>{t("models.metaBrand")}</Chip> : null;
}

export function ProviderChips({ provider }: { provider: Provider }) {
  const { t } = useI18n();
  return (
    <>
      <Chip kind="mute">{providerName(t, provider)}</Chip>
      <BrandChip provider={provider} />
    </>
  );
}
