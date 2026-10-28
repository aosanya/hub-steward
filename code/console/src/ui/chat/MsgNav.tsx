import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import { Icon } from "../Icon";
import type { MsgNavProps } from "../props";

export function MsgNav({ label, to, icon }: MsgNavProps) {
  const { t } = useI18n();
  return (
    <Link className="nav-div" to={to}>
      <span>
        <Icon name={icon} size={14} />
        {t("ui.opened").replace("{label}", label)}
        <Icon name="arrow" size={12} stroke={2.4} />
      </span>
    </Link>
  );
}
