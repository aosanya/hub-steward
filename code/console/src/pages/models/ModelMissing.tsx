import { hubPath } from "../../api";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Empty, TextLink } from "../../ui";

export function ModelMissing() {
  const { t } = useI18n();
  const { hub } = useConsole();
  return <Empty failed text={t("loadFailed")} action={<TextLink to={hubPath(hub.id, "models")}>{t("models.backToModels")}</TextLink>} />;
}
