import { useState } from "react";
import { removeWorkflow } from "../../data/removals";
import { useI18n } from "../../i18n";
import { useTellChat } from "../../shell/chatTell";
import type { Scenario } from "../../data/scenario";

export type Asked = { id: string; name: string };

export type Refusal = { name: string; scenarios: Scenario[] };

export const refusalText = (t: (key: string) => string, refusal: Refusal): string =>
  t(refusal.scenarios.length === 1 ? "workflows.removeRefusedOne" : "workflows.removeRefused")
    .replace("{name}", refusal.name)
    .replace("{n}", String(refusal.scenarios.length));

export function useWorkflowRemoval(hubId: string, reload: () => void) {
  const { t } = useI18n();
  const tellChat = useTellChat();
  const [asking, setAsking] = useState<Asked | null>(null);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<Refusal | null>(null);
  const [failedName, setFailedName] = useState("");

  const clear = () => {
    setRefused(null);
    setFailedName("");
  };

  const confirm = async () => {
    if (!asking) return;
    const asked = asking;
    setBusy(true);
    try {
      const outcome = await removeWorkflow(hubId, asked.id);
      if (outcome.kind === "refused") {
        const refusal = { name: asked.name, scenarios: outcome.scenarios };
        setRefused(refusal);
        tellChat(refusalText(t, refusal));
      } else reload();
    } catch {
      setFailedName(asked.name);
    }
    setBusy(false);
    setAsking(null);
  };

  return {
    asking,
    busy,
    refused,
    failedName,
    ask: (asked: Asked) => {
      clear();
      setAsking(asked);
    },
    cancel: () => setAsking(null),
    confirm,
  };
}
