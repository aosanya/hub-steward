import { useState } from "react";
import { agentStopped, type StoppedReply } from "../../data/agent";
import { useI18n } from "../../i18n";
import { useConsole } from "../../shell/context";
import { Button, Detail, Empty, FromChat, Stack, Tile, Toolbar } from "../../ui";
import { useAgentFrame } from "./AgentFrame";

type Answer = { failed: true } | { failed: false; reply: StoppedReply };

type Pair = [string, string];

const answerPairs = (t: (key: string) => string, reply: StoppedReply) =>
  ([
    [t("stopLimit"), reply.limit],
    [t("stopSetOn"), reply.set_on],
    [t("stopPosted"), reply.posted],
  ] as [string, string | undefined][]).filter((pair): pair is Pair => Boolean(pair[1]));

function AnswerView({ answer, name }: { answer: Answer; name: string }) {
  const { t } = useI18n();
  if (answer.failed) return <Empty failed text={t("loadFailed")} />;
  const { reply } = answer;
  const pairs = answerPairs(t, reply);
  const stopped = Boolean(reply.limit);
  return (
    <Stack>
      <Tile label={stopped ? t("agent.stopped") : ""} value={reply.stopped ?? ""} state={stopped ? "warn" : "ok"} />
      {pairs.length ? <Detail title={t("agent.stopCard").replace("{agent}", name)} pairs={pairs} /> : null}
    </Stack>
  );
}

export function StoppedAsk({ role }: { role: string }) {
  const { hub } = useConsole();
  const { t } = useI18n();
  const { name } = useAgentFrame();
  const [answer, setAnswer] = useState<Answer | null>(null);
  const question = t("agent.stopQuestion").replace("{agent}", name);

  const ask = async () => {
    const reply = await agentStopped(hub.id, role).catch(() => null);
    setAnswer(reply ? { failed: false, reply } : { failed: true });
  };

  if (!answer) return <Toolbar left={<Button kind="quiet" size="sm" onClick={ask}>{question}</Button>} />;
  return (
    <FromChat prompt={question} onClear={() => setAnswer(null)}>
      <AnswerView answer={answer} name={name} />
    </FromChat>
  );
}
