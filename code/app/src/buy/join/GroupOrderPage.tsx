import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { resolveMember } from "../../supply/api";
import { routes } from "../../routes";
import { BottomBar } from "../../ui/BottomBar";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { Chip } from "../../ui/Chip";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";
import { dayWords } from "../../ui/days";
import { bags, changedTermsWords, kes, mcpJoinClient, termsWords, type JoinClient, type OpenGroupOrder } from "./api";

type Props = { client?: JoinClient; me?: string };

const titleOf = (name: string) => (name ? `${name} group order` : "Group order");

function OpenOrder({ order, onJoin }: { order: OpenGroupOrder; onJoin: () => void }) {
  return (
    <>
      <Rows>
        <ListRow title="Terms" end={termsWords(order)} />
        <ListRow title="Bags so far" end={String(order.total)} />
        <ListRow title="Minimum" end={bags(order.minimum)} />
        <ListRow title="Farmers" end={String(order.count)} />
        {order.mine ? <ListRow title="Your bags" end={String(order.mine.quantity)} /> : null}
      </Rows>
      <Button kind="primary" onClick={onJoin}>
        {order.mine ? "Change my bags" : "Join the group order"}
      </Button>
    </>
  );
}

function Revision({ order, shop, client, answered }: { order: OpenGroupOrder; shop: string; client: JoinClient; answered: () => void }) {
  const [problem, setProblem] = useState("");
  const mine = order.mine!;
  const answer = async (value: "yes" | "no") => {
    setProblem("");
    try {
      await client.answerRevision(order.id, value);
      answered();
    } catch {
      setProblem("Your answer was not sent. Try again.");
    }
  };
  const share = (
    <Rows>
      <ListRow
        title="Your share"
        meta={bags(mine.quantity)}
        end={kes(mine.quantity * order.price)}
      />
    </Rows>
  );
  const started = order.startedWith ? <p className="meta">Started with {termsWords(order.startedWith)}</p> : null;
  if (mine.answer !== "waiting") {
    return (
      <>
        <Rows>
          <ListRow title="New terms" end={termsWords(order)} />
          <ListRow title="Your answer" end={mine.answer === "yes" ? <Chip tone="success">Yes</Chip> : <Chip tone="danger">No</Chip>} />
        </Rows>
        {share}
        {started}
      </>
    );
  }
  return (
    <>
      <p>{`${shop || "The shop"} changed its ${changedTermsWords(order, order.lastSeen) || "terms"}.`}</p>
      <Card>
        <p className="ttl">{`Do you accept ${termsWords(order)}?`}</p>
        {started}
      </Card>
      {share}
      {problem ? <p className="ferr" role="alert">{problem}</p> : null}
      <BottomBar>
        <Button onClick={() => answer("no")}>No</Button>
        <Button kind="primary" onClick={() => answer("yes")}>
          Yes
        </Button>
      </BottomBar>
    </>
  );
}

function Confirmed({ order, orderId, open }: { order: OpenGroupOrder; orderId: string; open: () => void }) {
  const mine = order.mine;
  return (
    <>
      <Rows>
        <ListRow title="Status" end={<Chip tone="success">Confirmed</Chip>} />
        {mine ? <ListRow title="Your share" end={bags(mine.quantity)} /> : null}
        <ListRow title="Price" end={`${kes(order.price)} a bag`} />
        {mine ? <ListRow title="Total" end={kes(mine.quantity * order.price)} /> : null}
        {order.date ? <ListRow title="Date" end={dayWords(order.date)} /> : null}
        {order.note ? <ListRow title="Note" end={order.note} /> : null}
      </Rows>
      {orderId ? <Button onClick={open}>See my order</Button> : null}
    </>
  );
}

type BodyProps = { order: OpenGroupOrder; shop: string; orderId: string; client: JoinClient; go: () => void; reload: () => void; open: () => void };

function Body({ order, shop, orderId, client, go, reload, open }: BodyProps) {
  if (order.state === "open") return <OpenOrder order={order} onJoin={go} />;
  if (order.state === "revising" && order.mine) return <Revision order={order} shop={shop} client={client} answered={reload} />;
  if (order.state === "revising")
    return (
      <Rows>
        <ListRow title="New terms" end={termsWords(order)} />
      </Rows>
    );
  if (order.state === "closed") return <Confirmed order={order} orderId={orderId} open={open} />;
  return <EmptyCard words="This group order is cancelled." />;
}

export function GroupOrderPage({ client = mcpJoinClient, me }: Props) {
  const navigate = useNavigate();
  const { productId = "", groupOrderId = "" } = useParams();
  const [round, setRound] = useState(0);
  const loaded = useLoad(async () => {
    const who = await resolveMember(me);
    const order = await client.getGroupOrder(groupOrderId, who);
    const shop = await client.shopName(order.posterId).catch(() => "");
    const name = order.product ? await client.productNameAt(order.posterId, order.product).catch(() => order.product) : "";
    const orderId = order.state === "closed" ? await client.findMyOrder(order, who).catch(() => "") : "";
    return { order, shop, name, orderId };
  }, `${groupOrderId}:${round}`);
  const title = loaded.state === "ready" ? titleOf(loaded.data.name) : "Group order";
  return (
    <Shell title={title} sub={loaded.state === "ready" ? loaded.data.shop : undefined} onBack={() => navigate(routes.product.path({ productId }))}>
      {loaded.state === "error" ? <LoadFailed words="This group order could not be opened." /> : null}
      {loaded.state === "ready" ? (
        <Body
          order={loaded.data.order}
          shop={loaded.data.shop}
          orderId={loaded.data.orderId}
          open={() => navigate(routes.boughtOrder.path({ orderId: loaded.data.orderId }))}
          client={client}
          go={() => navigate(routes.joinGroupOrder.path({ productId, groupOrderId }))}
          reload={() => setRound((n) => n + 1)}
        />
      ) : null}
    </Shell>
  );
}
