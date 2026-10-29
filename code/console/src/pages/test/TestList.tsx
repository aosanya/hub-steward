import { useState } from "react";
import { byName, matching } from "../../data/listView";
import { useI18n } from "../../i18n";
import {
  Button,
  Empty,
  SearchField,
  Stack,
  TextLink,
  Toggle,
  Toolbar,
  TitleRow,
} from "../../ui";
import { isFailed, totalTokens, type Scenario } from "../../data/scenario";
import { RemoveScenario } from "./RemoveScenario";
import { ScenarioCards } from "./ScenarioCards";
import { testPath } from "./paths";
import { removeFailedText, useScenarioActions } from "./useScenarioActions";

type Props = { hubId: string; scenarios: Scenario[]; reload: () => void };

export function TestList({ hubId, scenarios, reload }: Props) {
  const { t, lang } = useI18n();
  const [failedOnly, setFailedOnly] = useState(false);
  const [search, setSearch] = useState("");
  const act = useScenarioActions(hubId, scenarios, reload);
  const shown = byName(
    matching(failedOnly ? scenarios.filter(isFailed) : scenarios, (scenario) => [scenario.name], search),
    (scenario) => scenario.name,
  );
  const ticked = scenarios.filter((scenario) => act.ticked.has(scenario.id));
  const working = act.running.size;
  const primary =
    working > 0
      ? t("test.running").replace("{n}", String(working))
      : ticked.length > 0
        ? t("test.runSelected").replace("{n}", String(ticked.length))
        : t("test.runAll");
  const removing = scenarios.find((scenario) => scenario.id === act.removing);
  const add = (
    <Button kind="quiet" size="sm" icon="plus" onClick={act.openAdd}>
      {t("test.add")}
    </Button>
  );

  if (scenarios.length === 0)
    return (
      <>
        <TitleRow title={t("menu.test")} />
        <div className="content">
          <Empty
            text={t("test.empty")}
            action={
              <Button icon="plus" onClick={act.openAdd}>
                {t("test.add")}
              </Button>
            }
          />
        </div>
      </>
    );

  return (
    <>
      <TitleRow
        title={t("menu.test")}
        primary={primary}
        onPrimary={act.runPrimary(ticked)}
      />
      <div className="content">
        <Stack gap={12}>
          {act.failedName ? (
            <div className="empty error" role="alert">
              {removeFailedText(t, act.failedName)}
            </div>
          ) : null}
          {act.refusal ? (
            <div className="empty error" role="alert">
              {act.refusal}
            </div>
          ) : null}
          {removing ? (
            <RemoveScenario
              name={removing.name}
              busy={act.busy}
              onConfirm={act.confirmRemove}
              onCancel={act.cancelRemove}
            />
          ) : null}
          <Toolbar
            left={
              <>
                {add}
                <SearchField placeholder={t("test.search")} value={search} onChange={setSearch} />
                <Toggle
                  label={t("test.failedOnly")}
                  on={failedOnly}
                  onChange={setFailedOnly}
                />
              </>
            }
            right={
              <TextLink to={testPath(hubId, { rules: "1" })}>
                {t("chat.test.2")}
              </TextLink>
            }
          />
          <ScenarioCards
            hubId={hubId}
            scenarios={shown}
            ticked={act.ticked}
            running={act.running}
            onTick={act.tick}
            onRun={act.runOne}
            onRemove={act.askRemove}
          />
          <p className="soft">
            {t("test.totalTokens").replace(
              "{n}",
              totalTokens(scenarios).toLocaleString(lang),
            )}
          </p>
        </Stack>
      </div>
    </>
  );
}
