import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { kes } from "../../supply/api";
import { dayWords } from "../../ui/days";
import { routes } from "../../routes";
import { Button } from "../../ui/Button";
import { LoadFailed } from "../../ui/LoadState";
import { Chip } from "../../ui/Chip";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";
import { priceWords, quantityWords } from "../../market/unitWords";
import { mcpBuyNowClient, orderTotal, type BuyNowClient, type BuyOrder } from "./api";
import { agentLine, canCancel, orderStatus } from "./standing";

const toneOf = { Waiting: "accent", Yes: "success", Cancelled: "danger", Delivered: "info", Paid: "success" } as const;

export function BuyOrderPage({ client = mcpBuyNowClient }: { client?: BuyNowClient }) {
  const navigate = useNavigate();
  const { orderId = "" } = useParams();
  const neededBy = (useLocation().state as { neededBy?: string } | null)?.neededBy ?? "";
  const loaded = useLoad(() => client.getOrder(orderId), `buy-order-${orderId}`);
  const [changed, setChanged] = useState<BuyOrder | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const order = changed ?? (loaded.state === "ready" ? loaded.data : null);

  const cancel = async () => {
    setBusy(true);
    setFailed(false);
    try {
      setChanged(await client.cancelOrder(orderId));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const status = order ? orderStatus(order) : null;

  return (
    <Shell title={order ? `${quantityWords(order.quantity, order.unit)} of ${order.product}` : "My orders"} onBack={() => navigate(routes.market.path())}>
      {loaded.state === "error" ? <LoadFailed words="This order could not be loaded." /> : null}
      {order && status ? (
        <>
          <Rows>
            <ListRow title={order.shop} />
            <ListRow title="Status" end={<Chip tone={toneOf[status]}>{status}</Chip>} />
            <ListRow title="Price" end={priceWords(order.unitPrice, order.unit)} />
            <ListRow title="Total" end={kes(orderTotal(order))} />
            {neededBy ? <ListRow title="Needed by" end={dayWords(neededBy)} /> : null}
            {status === "Yes" ? <ListRow title="Shop's date" end={dayWords(order.promisedDate)} /> : null}
          </Rows>
          {status === "Waiting" || status === "Cancelled" ? <p>{agentLine(order)}</p> : null}
          {failed ? <p role="alert">Could not cancel this order. Try again.</p> : null}
          {canCancel(order) ? (
            <Button onClick={cancel} disabled={busy}>
              Cancel
            </Button>
          ) : null}
        </>
      ) : null}
    </Shell>
  );
}
