import { useI18n } from "../../i18n";
import { Card, Cell, Note, Stack } from "../../ui";
import type { Scenario } from "../../data/scenario";
import { formatWhen } from "../work/formatWhen";
import { ResultChip } from "./ResultChip";
import { ScenarioMenu } from "./ScenarioMenu";
import { testPath } from "./paths";

type Props = {
  hubId: string;
  scenarios: Scenario[];
  ticked: Set<string>;
  running: Set<string>;
  onTick: (id: string, on: boolean) => void;
  onRun: (scenario: Scenario) => void;
  onRemove: (scenario: Scenario) => void;
};

export function ScenarioCards({
  hubId,
  scenarios,
  ticked,
  running,
  onTick,
  onRun,
  onRemove,
}: Props) {
  const { t, lang } = useI18n();
  const dash = "—";
  return (
    <Stack gap={12}>
      {scenarios.map((scenario) => {
        const on = ticked.has(scenario.id);
        const shown = running.has(scenario.id)
          ? { ...scenario, result: "running" as const }
          : scenario;
        const when = scenario.last
          ? formatWhen(scenario.last.startedAt, lang)
          : dash;
        const used = scenario.last
          ? scenario.last.tokens.toLocaleString(lang)
          : dash;
        return (
          <Card key={scenario.id}>
            <Stack gap={10}>
              <div className="sc-head">
                <label className={on ? "opt on" : "opt"}>
                  <input
                    className="sr"
                    type="checkbox"
                    checked={on}
                    onChange={(e) => onTick(scenario.id, e.target.checked)}
                  />
                  <span className="opt-box" />
                  <span className="sr">
                    {t("test.select") + " " + scenario.name}
                  </span>
                </label>
                <Cell
                  text={scenario.name}
                  to={testPath(hubId, { open: scenario.id })}
                />
                <div className="sc-end">
                  <ResultChip result={shown.result} />
                  <ScenarioMenu
                    hubId={hubId}
                    scenario={shown}
                    busy={running.has(scenario.id)}
                    onRun={() => onRun(scenario)}
                    onRemove={() => onRemove(scenario)}
                  />
                </div>
              </div>
              <Note>{scenario.summary}</Note>
              <p className="sc-meta">
                {t("test.lastRun").replace("{when}", when)} ·{" "}
                {t("test.tokens").replace("{n}", used)}
              </p>
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
