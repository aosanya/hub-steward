import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { routes } from "../../routes";
import { Button } from "../../ui/Button";
import { LoadFailed } from "../../ui/LoadState";
import { ListRow, Rows } from "../../ui/ListRow";
import { useBackTo } from "../../ui/backTo";
import { Shell } from "../../ui/Shell";
import { kes, resolveMember } from "../../supply/api";
import { dayWords } from "../../supply/orders/api";
import { canCancelOrder, kindWords, mcpMyOrdersClient, orderTitle, trailDay, trailWords, type MyOrder, type MyOrdersClient, type TrailLine } from "./api";
import { StandingChip } from "./MyOrdersPage";

type Props = { client?: MyOrdersClient; me?: string; group?: boolean };

export function MyOrderPage({ client = mcpMyOrdersClient, me, group = false }: Props) {
  const navigate = useNavigate();
  const backTo = useBackTo("/my-orders");
  const { orderId = "", groupOrderId = "" } = useParams();
  const id = group ? groupOrderId : orderId;
  const loaded = useLoad(async () => {
    const who = await resolveMember(me);
    const order = group ? await client.getGroupLine(id, who) : await client.getOrder(id);
    const names = await client.supplierNames().catch(() => ({}) as Record<string, string>);
    const trail = group ? [] : await client.getTrail(id).catch(() => []);
    return { order, names, trail, who };
  }, `my-order-${group ? "group" : "buy"}-${id}`);
  const [changed, setChanged] = useState<{ order: MyOrder; trail: TrailLine[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const cancelled = await client.cancelOrder(id);
      const trail = await client.getTrail(id).catch(() => (loaded.state === "ready" ? loaded.data.trail : []));
      setChanged({ order: cancelled, trail });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (loaded.state !== "ready") {
    return (
      <Shell title="Order" onBack={() => navigate(backTo)}>
        {loaded.state === "error" ? <LoadFailed words="This order could not be loaded." /> : null}
      </Shell>
    );
  }

  const { names, who } = loaded.data;
  const order = changed?.order ?? loaded.data.order;
  const trail = changed?.trail ?? loaded.data.trail;
  const supplier = names[order.supplierId];
  return (
    <Shell title={orderTitle(order)} sub={[kindWords(order), order.product].filter(Boolean).join(" · ")} onBack={() => navigate(backTo)}>
      <Rows>
        <ListRow title="Status" end={<StandingChip standing={order.standing} />} />
        {supplier ? <ListRow title="Supplier" end={supplier} /> : null}
        <ListRow title={order.kind === "group" ? "Your share" : "Quantity"} end={String(order.quantity)} />
        <ListRow title="Price" end={`${kes(order.unitPrice)} each`} />
        <ListRow title="Total" end={kes(order.quantity * order.unitPrice)} />
        {order.promisedDate ? <ListRow title="Date" end={dayWords(order.promisedDate)} /> : null}
      </Rows>
      {order.kind === "buy" ? (
        <Rows>
          <ListRow title="Order card" onClick={() => navigate(routes.marketOrder.path({ orderId: order.id }))} />
        </Rows>
      ) : null}
      {failed ? <p role="alert">Could not cancel this order. Try again.</p> : null}
      {canCancelOrder(order) ? (
        <Button onClick={cancel} disabled={busy}>
          Cancel
        </Button>
      ) : null}
      {trail.length > 0 ? (
        <>
          <h2>Trail</h2>
          <Rows>
            {trail.map((line) => (
              <ListRow key={line.id} title={trailWords(line, who)} meta={trailDay(line)} />
            ))}
          </Rows>
        </>
      ) : null}
    </Shell>
  );
}
