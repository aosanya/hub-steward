import { useState } from "react";
import { doSomethingPath } from "../../routes";
import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { ListRow, Rows } from "../../ui/ListRow";
import { Roster } from "../../ui/roster/Roster";
import { loadFromList } from "../../ui/roster/usePagedRoster";
import { Shell } from "../../ui/Shell";
import { isApproved, mcpSupplyClient, mySupplier, resolveMember, type SupplyClient } from "../api";
import { bags, isLive, mcpGroupOrderClient, tally, termsWords, type GroupOrder, type GroupOrderClient, type OrderLine } from "./api";

type Clients = { client?: GroupOrderClient; supply?: SupplyClient; me?: string };

const answerChip = (answer: string) =>
  answer === "yes" ? <Chip tone="success">Yes</Chip> : answer === "no" ? <Chip tone="danger">No</Chip> : <Chip>Waiting</Chip>;

export function GroupOrdersPage({ client = mcpGroupOrderClient, supply = mcpSupplyClient, me }: Clients) {
  const navigate = useNavigate();
  const orders = useLoad(async () => {
    const mine = mySupplier(await supply.listSuppliers(), await resolveMember(me));
    if (!isApproved(mine)) return [];
    return (await client.listGroupOrders()).filter((o) => o.posterId === mine!.id && isLive(o));
  }, "group-orders");
  return (
    <Shell title="Group orders" onBack={() => navigate(doSomethingPath())}>
      {orders.state === "error" ? <LoadFailed words="Your group orders could not be loaded." /> : null}
      {orders.state === "ready" && orders.data.length === 0 ? (
        <EmptyCard words="No open group orders">
          <p>When farmers pool an order for your offer, it shows here.</p>
        </EmptyCard>
      ) : null}
      {orders.state === "ready" && orders.data.length > 0 ? (
        <Rows>
          {orders.data.map((o) => (
            <ListRow
              key={o.id}
              title={termsWords({ price: o.price, minimum: o.minimum })}
              meta={`${o.productWords} · ${bags(o.total)} of ${o.minimum}`}
              end="›"
              onClick={() => navigate(`/group-orders/${o.id}`)}
            />
          ))}
        </Rows>
      ) : null}
    </Shell>
  );
}

const lineRow = (withAnswers: boolean) => (l: OrderLine) =>
  withAnswers
    ? { key: l.id, title: l.picker, meta: bags(l.quantity), end: answerChip(l.answer) }
    : { key: l.id, title: l.picker, end: bags(l.quantity) };

function Order({ order, onRevise }: { order: GroupOrder; onRevise: () => void }) {
  const revising = order.state === "revising";
  const t = tally(order.lines);
  const farmers = `${order.count} ${order.count === 1 ? "farmer" : "farmers"}`;
  return (
    <>
      <Rows>
        <ListRow
          title={termsWords({ price: order.price, minimum: order.minimum })}
          meta={revising ? `${order.productWords} · new terms` : order.productWords}
        />
        {revising && order.startedWith ? <ListRow title={termsWords(order.startedWith)} meta="Started with" /> : null}
        <ListRow
          title={`${order.total} of ${order.minimum} bags`}
          meta={order.coordinator ? `${farmers} · started by ${order.coordinator}` : farmers}
        />
      </Rows>
      {!revising ? (
        <Button kind="primary" onClick={onRevise}>
          Ask the farmers to revise
        </Button>
      ) : null}
      <h2>{revising ? `${t.yes} yes · ${t.no} no · ${t.waiting} waiting` : farmers}</h2>
      <Roster load={loadFromList(order.lines, (l) => l.id)} toRow={lineRow(revising)} emptyTitle="No farmers yet" />
    </>
  );
}

export function GroupOrderPage({ client = mcpGroupOrderClient }: Clients) {
  const navigate = useNavigate();
  const { orderId = "" } = useParams();
  const order = useLoad(() => client.getGroupOrder(orderId), `go${orderId}`);
  return (
    <Shell title="Group order" onBack={() => navigate("/group-orders")}>
      {order.state === "error" ? <LoadFailed words="This group order could not be opened." /> : null}
      {order.state === "ready" ? <Order order={order.data} onRevise={() => navigate(`/group-orders/${orderId}/revise`)} /> : null}
    </Shell>
  );
}

const num = (s: string) => {
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : NaN;
};

export function ReviseGroupOrderPage({ client = mcpGroupOrderClient }: Clients) {
  const navigate = useNavigate();
  const { orderId = "" } = useParams();
  const order = useLoad(() => client.getGroupOrder(orderId), `rv${orderId}`);
  return (
    <Shell title="Ask the farmers to revise" onBack={() => navigate(`/group-orders/${orderId}`)}>
      {order.state === "error" ? <LoadFailed words="This group order could not be opened." /> : null}
      {order.state === "ready" ? <ReviseForm client={client} order={order.data} done={() => navigate(`/group-orders/${orderId}`)} /> : null}
    </Shell>
  );
}

function ReviseForm({ client, order, done }: { client: GroupOrderClient; order: GroupOrder; done: () => void }) {
  const [price, setPrice] = useState(String(order.price));
  const [minimum, setMinimum] = useState(String(order.minimum));
  const [problem, setProblem] = useState("");
  const ask = async () => {
    const terms = { price: num(price), minimum: num(minimum) };
    if (Number.isNaN(terms.price)) return setProblem("Give the price a bag as a number.");
    if (Number.isNaN(terms.minimum)) return setProblem("Give the minimum bags as a number.");
    setProblem("");
    try {
      await client.askRevision(order.id, terms);
      done();
    } catch {
      setProblem("The farmers were not asked. Try again.");
    }
  };
  return (
    <Card>
      <Field label="Price a bag (KES)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      <Field label="Minimum bags" inputMode="decimal" value={minimum} onChange={(e) => setMinimum(e.target.value)} />
      {problem ? <p className="ferr">{problem}</p> : null}
      <Button kind="primary" onClick={ask}>
        Ask the farmers
      </Button>
    </Card>
  );
}
