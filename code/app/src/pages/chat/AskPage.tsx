import { useNavigate, useParams } from "react-router-dom";
import { mcpChatClient, type ChatClient } from "../../chat/api";
import { useLoad } from "../../forms/useLoad";
import { routes } from "../../routes";
import { AskForm } from "../../supply/asks/AskForm";
import { noStock, type StockReader } from "../../supply/asks/stock";
import { LoadFailed } from "../../ui/LoadState";
import { Shell } from "../../ui/Shell";

export function AskPage({ client = mcpChatClient, readStock = noStock }: { client?: ChatClient; readStock?: StockReader }) {
  const { roomId = "", threadId = "", askId = "" } = useParams();
  const navigate = useNavigate();
  const ask = useLoad(() => client.getAsk(askId), askId);
  return (
    <Shell title="Ask" onBack={() => navigate(routes.roomThread.path({ roomId, threadId }))}>
      {ask.state === "error" || (ask.state === "ready" && ask.data === null) ? <LoadFailed words="The ask could not be found." /> : null}
      {ask.state === "ready" && ask.data ? (
        <AskForm ask={ask.data} readStock={readStock} onAnswer={(reply) => client.answerAsk(askId, reply)} />
      ) : null}
    </Shell>
  );
}
