import { useI18n } from "../../i18n";
import { Chip } from "../../ui";
import { resultKind } from "./paths";

export function ResultChip({ result }: { result: string }) {
  const { t } = useI18n();
  return <Chip kind={resultKind(result)}>{t("test.result." + result)}</Chip>;
}
