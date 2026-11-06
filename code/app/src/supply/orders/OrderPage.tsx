import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { Button } from "../../ui/Button";
import { LoadFailed } from "../../ui/LoadState";
import { Chip } from "../../ui/Chip";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";
import { dayWords } from "../../ui/days";
import { mcpOrdersClient, priceLine, type OrdersClient, type SupplyOrder } from "./api";

export function OrderPage({ client = mcpOrdersClient }: { client?: OrdersClient }) {
  const navigate = useNavigate();
  const { orderId = "" } = useParams();
  const loaded = useLoad(() => client.getOrder(orderId), `order-${orderId}`);
  const [marked, setMarked] = useState<SupplyOrder | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const order = marked ?? (loaded.state === "ready" ? loaded.data : null);
  const yesId = order?.yesId ?? "";
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!yesId) return;
    let live = true;
    client.listYeses().then(
      (yeses) => live && setNote(yeses.find((y) => y.id === yesId)?.note ?? ""),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [client, yesId]);

  const markPaid = async () => {
    setBusy(true);
    setFailed(false);
    try {
      setMarked(await client.markPaid(orderId));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={order?.picker || "Order"} onBack={() => navigate("/orders")}>
      {loaded.state === "error" ? <LoadFailed words="This order could not be loaded." /> : null}
      {order ? (
        <>
          <Rows>
            <ListRow
              title={`${order.quantity} of ${order.product}`}
              meta={priceLine(order)}
              end={order.paid ? <Chip tone="success">Paid</Chip> : <Chip tone="accent">Open</Chip>}
            />
            <ListRow title={dayWords(order.createdAt)} />
            {order.promisedDate ? <ListRow title="Date he gave" meta={[dayWords(order.promisedDate), note]} /> : null}
          </Rows>
          {failed ? <p role="alert">Could not mark this order paid. Try again.</p> : null}
          {order.paid ? null : (
            <Button kind="primary" onClick={markPaid} disabled={busy}>
              Mark paid
            </Button>
          )}
        </>
      ) : null}
    </Shell>
  );
}
