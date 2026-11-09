import { useState } from "react";
import { doSomethingPath } from "../../routes";
import { useNavigate, useParams } from "react-router-dom";
import { listAsks, mcpChatClient, isWaiting, type Ask, type ChatClient } from "../../chat/api";
import { useLoad } from "../../forms/useLoad";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { ListRow, Rows } from "../../ui/ListRow";
import { Segmented } from "../../ui/Segmented";
import { Shell } from "../../ui/Shell";
import { AskForm } from "./AskForm";
import { noStock, type StockReader } from "./stock";

type Source = () => Promise<Ask[]>;

export function AsksPage({ source = listAsks }: { source?: Source }) {
  const navigate = useNavigate();
  const asks = useLoad(source, "asks");
  const [tab, setTab] = useState<"waiting" | "answered">("waiting");
  const waitingCount = asks.state === "ready" ? asks.data.filter(isWaiting).length : 0;
  const shown = asks.state === "ready" ? asks.data.filter((ask) => isWaiting(ask) === (tab === "waiting")) : [];
  return (
    <Shell title="Asks" onBack={() => navigate(doSomethingPath())}>
      <Segmented
        items={[
          { id: "waiting", label: waitingCount > 0 ? `Waiting · ${waitingCount}` : "Waiting" },
          { id: "answered", label: "Answered" },
        ]}
        current={tab}
        onChange={setTab}
      />
      {asks.state === "error" ? <LoadFailed words="The asks could not be loaded." /> : null}
      {asks.state === "ready" && shown.length === 0 ? <EmptyCard words={tab === "waiting" ? "No asks are waiting." : "No asks answered yet."} /> : null}
      {shown.length > 0 ? (
        <Rows>
          {shown.map((ask) => (
            <ListRow key={ask.id} title={ask.question} meta={ask.asker} end="›" onClick={() => navigate(`/asks/${ask.id}`)} />
          ))}
        </Rows>
      ) : null}
    </Shell>
  );
}

export function OneAskPage({ client = mcpChatClient, readStock = noStock }: { client?: ChatClient; readStock?: StockReader }) {
  const { askId = "" } = useParams();
  const navigate = useNavigate();
  const ask = useLoad(() => client.getAsk(askId), askId);
  return (
    <Shell title="Ask" onBack={() => navigate("/asks")}>
      {ask.state === "error" || (ask.state === "ready" && ask.data === null) ? <LoadFailed words="The ask could not be found." /> : null}
      {ask.state === "ready" && ask.data ? (
        <AskForm ask={ask.data} readStock={readStock} showAnswer onAnswer={(reply) => client.answerAsk(askId, reply)} />
      ) : null}
    </Shell>
  );
}
