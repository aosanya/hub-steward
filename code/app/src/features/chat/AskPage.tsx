import { useNavigate, useParams } from "react-router-dom";
import { mcpChatClient, type ChatClient } from "./api";
import { useLoad } from "../../features/forms/useLoad";
import { routes } from "../../app/routes";
import { AskForm } from "../../features/market/supply/asks/AskForm";
import { noStock, type StockReader } from "../../features/market/supply/asks/stock";
import { LoadFailed } from "../../shared/ui/LoadState";
import { Shell } from "../../shared/ui/Shell";

export function AskPage({ client = mcpChatClient, readStock = noStock }: { client?: ChatClient; readStock?: StockReader }) {
  const { roomId = "", threadId = "", askId = "" } = useParams();
  const navigate = useNavigate();
  const ask = useLoad(() => client.getAsk(askId), askId);
  return (
    <Shell title="Ask" tabless onBack={() => navigate(routes.roomThread.path({ roomId, threadId }))}>
      {ask.state === "error" || (ask.state === "ready" && ask.data === null) ? <LoadFailed words="The ask could not be found." /> : null}
      {ask.state === "ready" && ask.data ? (
        <AskForm ask={ask.data} readStock={readStock} onAnswer={(reply) => client.answerAsk(askId, reply)} />
      ) : null}
    </Shell>
  );
}
