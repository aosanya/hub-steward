import { hubPath } from "../../api";
import { accountUsers } from "../../data/accounts";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { TextLink } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";

const unknownCount = "–";

export function UsedBy({ accountId }: { accountId: string }) {
  const { t } = useI18n();
  const { hub } = useConsole();
  const { state: users } = useLoaded(() => accountUsers(hub.id, accountId), [hub.id, accountId]);

  if (users.kind === "loading") return null;
  if (users.kind === "failed") return <span className="muted">{unknownCount}</span>;

  const count = users.value.length;
  if (count === 0) return <span className="muted">{t("models.usedBy.none")}</span>;
  const text = count === 1 ? t("models.usedBy.one") : t("models.usedBy.many").replace("{n}", String(count));
  return (
    <TextLink size="sm" arrow to={hubPath(hub.id, "models", accountId, "users")} className="mk-nowrap">
      {text}
    </TextLink>
  );
}
