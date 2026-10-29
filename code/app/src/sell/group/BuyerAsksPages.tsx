import { BuyerTabs } from "../buyer/BuyerTabs";
import { useNavigate, useParams } from "react-router-dom";
import type { AskAnswer, ChatClient } from "../../chat/api";
import type { SupplyOffer } from "../../supply/api";
import { useLoad } from "../../forms/useLoad";
import { AskForm } from "../../supply/asks/AskForm";
import { OneAskPage } from "../../supply/asks/AsksPage";
import { liveStock } from "../../supply/asks/liveStock";
import { noStock, type StockReader } from "../../supply/asks/stock";
import { Card } from "../../ui/Card";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { Chip } from "../../ui/Chip";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";
import { answeredAsks, askPrice, mcpBuyerAskClient, waitingAsks, type BuyerAsk, type BuyerAskClient } from "./buyerAsksApi";

type Props = { client?: BuyerAskClient; me?: string; readStock?: StockReader; back?: string };

const answerChip = (ask: BuyerAsk) => (ask.answer === "yes" ? <Chip tone="success">Yes</Chip> : <Chip tone="danger">No</Chip>);

export function BuyerAsksPage({ client = mcpBuyerAskClient, me }: Props) {
  const navigate = useNavigate();
  const asks = useLoad(() => client.list(me), "buyer-asks");
  const waiting = asks.state === "ready" ? waitingAsks(asks.data) : [];
  const answered = asks.state === "ready" ? answeredAsks(asks.data) : [];
  return (
    <Shell title="Asks" onBack={() => navigate("/prices")}>
      <BuyerTabs active="asks" />
      {asks.state === "error" ? <LoadFailed words="The asks could not be loaded." /> : null}
      {asks.state === "ready" && waiting.length === 0 ? <EmptyCard words="No asks are waiting." /> : null}
      {waiting.length > 0 ? (
        <Rows>
          {waiting.map((ask) => (
            <ListRow key={ask.id} title={ask.asker} meta={ask.question} end="›" onClick={() => navigate(`/sell/asks/${ask.id}`)} />
          ))}
        </Rows>
      ) : null}
      {answered.length > 0 ? (
        <>
          <h2>Answered</h2>
          <Rows>
            {answered.map((ask) => (
              <ListRow key={ask.id} title={ask.asker} meta={ask.question} end={answerChip(ask)} onClick={() => navigate(`/sell/asks/${ask.id}`)} />
            ))}
          </Rows>
        </>
      ) : null}
    </Shell>
  );
}

type AskLists = { list: BuyerAsk[]; offers: SupplyOffer[] };

const loadAskLists = async (client: BuyerAskClient, me?: string): Promise<AskLists> => {
  const [list, offers] = await Promise.all([client.list(me), (client.offers?.(me) ?? Promise.resolve([])).catch(() => [])]);
  return { list, offers };
};

type ViewProps = { client: BuyerAskClient; askId: string; lists: AskLists; readStock: StockReader };

function BuyerAskView({ client, askId, lists, readStock }: ViewProps) {
  const ask = lists.list.find((a) => a.id === askId);
  const price = ask ? askPrice(ask, lists.offers) : null;
  return (
    <>
      {!ask ? <LoadFailed words="The ask could not be found." /> : null}
      {price ? (
        <Card>
          <p className="ttl">{price.unitWords}</p>
          <p className="meta">Your price · {price.totalWords}</p>
        </Card>
      ) : null}
      {ask ? <AskForm ask={ask} readStock={readStock} showAnswer onAnswer={(reply: AskAnswer) => client.answer(askId, reply)} /> : null}
    </>
  );
}

export function BuyerAskPage({ client = mcpBuyerAskClient, me, readStock = noStock, back = "/sell/asks" }: Props) {
  const { askId = "" } = useParams();
  const navigate = useNavigate();
  const asks = useLoad(() => loadAskLists(client, me), "buyer-asks");
  return (
    <Shell title="Ask" onBack={() => navigate(back)}>
      {asks.state === "error" ? <LoadFailed words="The ask could not be found." /> : null}
      {asks.state === "ready" ? <BuyerAskView client={client} askId={askId} lists={asks.data} readStock={readStock} /> : null}
    </Shell>
  );
}

type RouteProps = Props & { chat?: ChatClient };

const noLists: AskLists = { list: [], offers: [] };

export function AskRoutePage({ client = mcpBuyerAskClient, me, chat }: RouteProps) {
  const { askId = "" } = useParams();
  const navigate = useNavigate();
  const route = useLoad(() => loadAskLists(client, me).catch(() => noLists), `route-${askId}`);
  if (route.state !== "ready") return null;
  const lists = route.data;
  const ask = lists.list.find((a) => a.id === askId);
  if (!ask || !askPrice(ask, lists.offers)) return <OneAskPage client={chat} readStock={liveStock} />;
  return (
    <Shell title="Ask" onBack={() => navigate("/asks")}>
      <BuyerAskView client={client} askId={askId} lists={lists} readStock={liveStock} />
    </Shell>
  );
}
