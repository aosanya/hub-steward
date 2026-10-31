import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import "./ui.css";

type IconActionProps = { icon: string; label: string; disabled?: boolean; danger?: boolean };

export function IconButton({ icon, label, onClick, disabled, danger }: IconActionProps & { onClick: () => void }) {
  return (
    <button type="button" className={danger ? "icon-action danger" : "icon-action"} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={22} />
    </button>
  );
}

export function IconLink({ icon, label, to }: IconActionProps & { to: string }) {
  return (
    <Link to={to} className="icon-action" aria-label={label} title={label}>
      <Icon name={icon} size={22} />
    </Link>
  );
}
