import { useI18n } from "../i18n";

export function Loading() {
  const { t } = useI18n();
  return (
    <div className="loading" role="status">
      <span className="tool-spin" aria-hidden="true" />
      <span className="sr">{t("loading")}</span>
    </div>
  );
}
