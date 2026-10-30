import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import { Button } from "../../ui";
import "../test/test.css";

type Props = { editTo: string; onRemove?: () => void };

export function WorkflowMenu({ editTo, onRemove }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="act-wrap end">
      <Button kind="quiet" size="sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t("workflows.actions")} <span aria-hidden="true">▾</span>
      </Button>
      {open ? (
        <div className="act-menu" role="menu">
          <Link role="menuitem" className="act-item" to={editTo} onClick={close}>
            {t("workflows.editLink")}
          </Link>
          {onRemove ? (
            <button
              type="button"
              role="menuitem"
              className="act-item bad"
              onClick={() => {
                close();
                onRemove();
              }}
            >
              {t("workflows.remove")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
