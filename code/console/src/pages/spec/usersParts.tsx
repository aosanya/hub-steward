import { useI18n } from "../../i18n";
import { Chip, Row } from "../../ui";

export function PendingNote() {
  const { t } = useI18n();
  return (
    <div role="status">
      <Row>
        <Chip kind="warn">{t("waitingForApproval")}</Chip>
        <span className="muted">{t("pendingApproval")}</span>
      </Row>
    </div>
  );
}

export function Dash() {
  return <span className="muted">&mdash;</span>;
}

export const shortDate = (iso: string, lang: string): string => {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  const date = new Date(time);
  const thisYear = date.getFullYear() === new Date().getFullYear();
  const options: Intl.DateTimeFormatOptions = thisYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" };
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : lang, options).format(date);
};
