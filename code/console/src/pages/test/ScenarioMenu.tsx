import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import { Button } from "../../ui";
import { reportPath, testPath } from "./paths";
import type { Scenario } from "../../data/scenario";

type Props = {
  hubId: string;
  scenario: Scenario;
  busy: boolean;
  onRun: () => void;
  onRemove: () => void;
};

export function ScenarioMenu({
  hubId,
  scenario,
  busy,
  onRun,
  onRemove,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ranBefore = scenario.lastRunId !== "";
  const again =
    ranBefore || scenario.result === "failed" || scenario.result === "stopped";
  const close = () => setOpen(false);
  const choose = (action: () => void) => () => {
    close();
    action();
  };
  return (
    <div className="act-wrap">
      <Button
        kind="quiet"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t("test.actions")}
      </Button>
      {open ? (
        <div className="act-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="act-item"
            disabled={busy}
            onClick={choose(onRun)}
          >
            {t(again ? "test.runAgain" : "test.run")}
          </button>
          {ranBefore ? (
            <>
              <Link
                role="menuitem"
                className="act-item"
                to={testPath(hubId, { run: scenario.lastRunId })}
                onClick={close}
              >
                {t("test.openLast")}
              </Link>
              <Link
                role="menuitem"
                className="act-item"
                to={reportPath(hubId, scenario.lastRunId)}
                onClick={close}
              >
                {t("test.print")}
              </Link>
            </>
          ) : null}
          <Link
            role="menuitem"
            className="act-item"
            to={testPath(hubId, { edit: scenario.id })}
            onClick={close}
          >
            {t("test.edit")}
          </Link>
          <button
            type="button"
            role="menuitem"
            className="act-item bad"
            onClick={choose(onRemove)}
          >
            {t("test.remove")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
