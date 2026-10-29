import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { removeScenario } from "../../data/removals";
import { useI18n } from "../../i18n";
import { useTellChat } from "../../shell/chatTell";
import { runOne, runScenarios, type Scenario } from "../../data/scenario";
import { refusalOf } from "../../data/testRun";
import { testPath } from "./paths";

export const removeFailedText = (
  t: (key: string) => string,
  name: string,
): string => t("test.removeFailed").replace("{name}", name);

export function useScenarioActions(
  hubId: string,
  scenarios: Scenario[],
  reload: () => void,
) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const tellChat = useTellChat();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState("");
  const [busy, setBusy] = useState(false);
  const [failedName, setFailedName] = useState("");
  const [refusal, setRefusal] = useState("");

  const tick = (id: string, on: boolean) =>
    setTicked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const refuse = (error: unknown) =>
    setRefusal(refusalOf(error) || t("test.runNotStarted"));

  const start = (ids: string[], call: () => Promise<void>) => {
    setRunning(new Set(ids));
    setRefusal("");
    call()
      .catch(refuse)
      .finally(() => {
        setRunning(new Set());
        reload();
      });
  };

  const runOneScenario = (scenario: Scenario) =>
    start([scenario.id], async () => {
      const id = await runOne(hubId, scenario.id);
      if (id !== "") navigate(testPath(hubId, { run: id }));
    });

  const runPrimary = (chosen: Scenario[]) => () => {
    const targets = chosen.length > 0 ? chosen : scenarios;
    const ids = targets.map((scenario) => scenario.id);
    start(ids, () => runScenarios(hubId, chosen.length > 0 ? ids : []));
  };

  const confirmRemove = async () => {
    const scenario = scenarios.find((entry) => entry.id === removing);
    if (!scenario) return;
    setBusy(true);
    try {
      await removeScenario(hubId, scenario.id);
      reload();
    } catch {
      setFailedName(scenario.name);
      tellChat(removeFailedText(t, scenario.name));
    }
    setBusy(false);
    setRemoving("");
  };

  return {
    ticked,
    running,
    removing,
    busy,
    failedName,
    refusal,
    tick,
    runOne: runOneScenario,
    runPrimary,
    askRemove: (scenario: Scenario) => {
      setFailedName("");
      setRemoving(scenario.id);
    },
    cancelRemove: () => setRemoving(""),
    confirmRemove,
    openAdd: () => navigate(testPath(hubId, { add: "1" })),
  };
}
