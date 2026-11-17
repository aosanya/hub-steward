import { useI18n } from "../../i18n";
import { Stack, Toggle } from "../../ui";

type ListingControlProps = { listed: boolean; onChange: (listed: boolean) => void };

export function ListingControl({ listed, onChange }: ListingControlProps) {
  const { t } = useI18n();
  return (
    <Stack gap={8}>
      <Toggle label={t("general.listed")} on={listed} onChange={onChange} />
      <span className="muted">{t("general.listedNote")}</span>
    </Stack>
  );
}
