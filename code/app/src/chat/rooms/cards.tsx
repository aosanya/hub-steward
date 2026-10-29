import { useState } from "react";
import { useLoad } from "../../forms/useLoad";
import { routes } from "../../routes";
import { bags, termsWords } from "../../supply/groupOrder/api";
import { Button } from "../../ui/Button";
import { attachmentKinds, type RoomAsk, type RoomMessage, type RoomOrder, type RoomsClient } from "./api";

const titleOf = (productWords: string) => (productWords === "" ? "Group order" : `${productWords} group order`);

export const joinPath = (product: string, orderId: string) => routes.joinGroupOrder.path({ productId: product, groupOrderId: orderId });

export const askShopsPath = (requestId: string, what: string) =>
  `/buy/wanted/${encodeURIComponent(requestId)}/ask?${new URLSearchParams({ what }).toString()}`;

export const buyNowPath = (ask: RoomAsk) =>
  ask.offerId === "" ? "" : routes.buyNow.path({ productId: ask.productId, offerId: ask.offerId }, ask.yesId ? { yes: ask.yesId } : undefined);

export const noticePath = "/buy/wanted";

export const askPath = (roomId: string, threadId: string, askId: string) => routes.ask.path({ roomId, threadId, askId });

function Revision({ order, client, onAnswered }: { order: RoomOrder; client: RoomsClient; onAnswered: () => void }) {
  const [problem, setProblem] = useState("");
  const answer = async (reply: "yes" | "no") => {
    setProblem("");
    try {
      await client.answerRevision(order.order.id, reply);
      onAnswered();
    } catch {
      setProblem("Your answer was not sent. Try again.");
    }
  };
  return (
    <>
      <span className="rm-ttl">{titleOf(order.productWords)}</span>
      <span className="rm-line">Now {termsWords(order.order)}</span>
      {order.order.startedWith ? <span className="rm-line">Started with {termsWords(order.order.startedWith)}</span> : null}
      {order.myQuantity > 0 ? <span className="rm-line">Your line: {bags(order.myQuantity)}</span> : null}
      {problem ? <p className="ferr">{problem}</p> : null}
      <div className="rm-btns">
        <Button onClick={() => answer("no")}>No</Button>
        <Button kind="primary" onClick={() => answer("yes")}>
          Yes
        </Button>
      </div>
    </>
  );
}

function OrderBody({ order, client, onAnswered }: { order: RoomOrder; client: RoomsClient; onAnswered: () => void }) {
  if (order.order.state === "revising" && order.myAnswer === "waiting") {
    return <Revision order={order} client={client} onAnswered={onAnswered} />;
  }
  return (
    <>
      <span className="rm-ttl">{titleOf(order.productWords)}</span>
      <span className="rm-line">{termsWords(order.order)}</span>
      {order.order.state === "revising" && order.myAnswer !== "" ? <span className="rm-line">You said {order.myAnswer}</span> : null}
      {order.order.state === "open" ? (
        <div className="rm-btns">
          <Button kind="primary" to={joinPath(order.order.product, order.order.id)}>
            Join
          </Button>
        </div>
      ) : null}
    </>
  );
}

function GroupOrderCard({ orderId, client }: { orderId: string; client: RoomsClient }) {
  const [round, setRound] = useState(0);
  const order = useLoad(() => client.getOrder(orderId), `${orderId}/${round}`);
  if (order.state !== "ready") return null;
  return (
    <div className="rm-card">
      <OrderBody order={order.data} client={client} onAnswered={() => setRound(round + 1)} />
    </div>
  );
}

function RequestCard({ requestId, title }: { requestId: string; title: string }) {
  return (
    <div className="rm-card">
      <span className="rm-ttl">{title}</span>
      <div className="rm-btns">
        <Button to={noticePath}>Put up a notice</Button>
        <Button kind="primary" to={askShopsPath(requestId, title)}>
          Ask shops
        </Button>
      </div>
    </div>
  );
}

function FoundBody({ ask, title }: { ask: RoomAsk; title: string }) {
  const found = [ask.posterName, ask.detail].filter((part) => part !== "").join(" · ");
  const buy = buyNowPath(ask);
  return (
    <div className="rm-card">
      <span className="rm-ttl">{title}</span>
      {found ? <span className="rm-line">{found}</span> : null}
      {buy ? (
        <div className="rm-btns">
          <Button kind="primary" to={buy}>
            Buy now
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AskBody({ ask, title, open }: { ask: RoomAsk; title: string; open: () => void }) {
  if (ask.mine) return ask.answer === "yes" ? <FoundBody ask={ask} title={title} /> : null;
  return (
    <div className="rm-btns">
      <Button kind="primary" onClick={open}>
        Answer the ask
      </Button>
      <Button onClick={open}>Open</Button>
    </div>
  );
}

function AskCard({ askId, title, open, client }: { askId: string; title: string; open: () => void; client: RoomsClient }) {
  const ask = useLoad(() => client.getAsk(askId), askId);
  if (ask.state !== "ready" || ask.data === null) return null;
  return <AskBody ask={ask.data} title={title} open={open} />;
}

type Props = { message: RoomMessage; threadLabel: string; client: RoomsClient; openAsk: (askId: string) => void };

export function Attachment({ message, threadLabel, client, openAsk }: Props) {
  if (message.targetId === "") return null;
  if (message.kind === attachmentKinds.groupOrder) return <GroupOrderCard orderId={message.targetId} client={client} />;
  if (message.kind === attachmentKinds.request) return <RequestCard requestId={message.targetId} title={threadLabel} />;
  if (message.kind === attachmentKinds.ask) {
    return <AskCard askId={message.targetId} title={threadLabel} client={client} open={() => openAsk(message.targetId)} />;
  }
  return null;
}
