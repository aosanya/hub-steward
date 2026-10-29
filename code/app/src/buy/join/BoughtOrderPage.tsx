import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { routes } from "../../routes";
import { LoadFailed } from "../../ui/LoadState";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";
import { resolveMember } from "../../supply/api";
import { buyStanding, mcpMyOrdersClient, trailDay, trailWords, type MyOrdersClient } from "../orders/api";
import { StandingChip } from "../orders/MyOrdersPage";
import { bags, dayWords, kes, mcpJoinClient, type BoughtOrder, type JoinClient } from "./api";

type Props = { client?: JoinClient; orders?: Pick<MyOrdersClient, "getOrder" | "getTrail">; me?: string };

function Details({ order, paid }: { order: BoughtOrder; paid: boolean | null }) {
  return (
    <>
      <Rows>
        {paid === null ? null : (
          <ListRow title="Status" end={<StandingChip standing={buyStanding({ state: order.state, paid, promised_date: order.promisedDate })} />} />
        )}
        <ListRow title="Your share" end={bags(order.quantity)} />
        <ListRow title="Price" end={`${kes(order.unitPrice)} a bag`} />
        <ListRow title="Total" end={kes(order.quantity * order.unitPrice)} />
        {order.promisedDate ? <ListRow title="Date" end={dayWords(order.promisedDate)} /> : null}
      </Rows>
    </>
  );
}

export function BoughtOrderPage({ client = mcpJoinClient, orders = mcpMyOrdersClient, me }: Props) {
  const navigate = useNavigate();
  const { orderId = "" } = useParams();
  const loaded = useLoad(async () => {
    const order = await client.getOrder(orderId);
    const shop = await client.shopName(order.posterId).catch(() => "");
    const name = order.product ? await client.productNameAt(order.posterId, order.product).catch(() => order.product) : "";
    return { order, shop, name };
  }, `bought${orderId}`);
  const extra = useLoad(async () => {
    const who = await resolveMember(me);
    const paid = await orders.getOrder(orderId).then((o) => o.standing === "Paid", () => false);
    const trail = await orders.getTrail(orderId).catch(() => []);
    return { who, paid, trail };
  }, `bought-trail${orderId}`);
  const name = loaded.state === "ready" ? loaded.data.name : "";
  const more = extra.state === "ready" ? extra.data : { who: "", paid: false, trail: [] };
  return (
    <Shell title={name || "Order"} sub={loaded.state === "ready" ? loaded.data.shop : undefined} onBack={() => navigate(routes.market.path())}>
      {loaded.state === "error" ? <LoadFailed words="This order could not be opened." /> : null}
      {loaded.state === "ready" ? <Details order={loaded.data.order} paid={extra.state === "loading" ? null : more.paid} /> : null}
      {loaded.state === "ready" && more.trail.length > 0 ? (
        <>
          <h2>Trail</h2>
          <Rows>
            {more.trail.map((line) => (
              <ListRow key={line.id} title={trailWords(line, more.who)} meta={trailDay(line)} />
            ))}
          </Rows>
        </>
      ) : null}
    </Shell>
  );
}
