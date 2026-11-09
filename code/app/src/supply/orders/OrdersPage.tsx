import { useState } from "react";
import { doSomethingPath } from "../../routes";
import { useNavigate } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { Button } from "../../ui/Button";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { Chip } from "../../ui/Chip";
import { ListRow, Rows } from "../../ui/ListRow";
import { Segmented } from "../../ui/Segmented";
import { Shell } from "../../ui/Shell";
import { kes } from "../api";
import { mcpOrdersClient, orderMeta, orderTotal, yesMeta, type OrdersClient } from "./api";

export function OrdersPage({ client = mcpOrdersClient }: { client?: OrdersClient }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"open" | "paid">("open");
  const loaded = useLoad(async () => ({ yeses: await client.listYeses(), orders: await client.listOrders() }), "orders");
  const open = loaded.state === "ready" ? loaded.data.orders.filter((o) => !o.paid) : [];
  const paid = loaded.state === "ready" ? loaded.data.orders.filter((o) => o.paid) : [];
  const yeses = loaded.state === "ready" ? loaded.data.yeses.filter((y) => y.state === "open") : [];
  const openCount = open.length + yeses.length;
  return (
    <Shell title="Orders" onBack={() => navigate(doSomethingPath())}>
      <Segmented
        items={[
          { id: "open", label: `Open · ${openCount}` },
          { id: "paid", label: `Paid · ${paid.length}` },
        ]}
        current={tab}
        onChange={setTab}
      />
      {loaded.state === "error" ? <LoadFailed words="Your orders could not be loaded." /> : null}
      {loaded.state === "ready" && tab === "open" && openCount === 0 ? (
        <EmptyCard words="No open yeses or orders">
          <Button kind="primary" onClick={() => navigate("/asks")}>
            Asks
          </Button>
        </EmptyCard>
      ) : null}
      {loaded.state === "ready" && tab === "open" && yeses.length > 0 ? (
        <>
          <h2>Yeses · {yeses.length}</h2>
          <Rows>
            {yeses.map((y) => (
              <ListRow key={y.id} title={y.picker} meta={[yesMeta(y), y.note]} end={<Chip>Yes</Chip>} />
            ))}
          </Rows>
        </>
      ) : null}
      {loaded.state === "ready" && tab === "open" && open.length > 0 ? (
        <>
          <h2>Orders · {open.length}</h2>
          <Rows>
            {open.map((o) => (
              <ListRow key={o.id} title={o.picker} meta={orderMeta(o)} end={kes(orderTotal(o))} onClick={() => navigate(`/orders/${o.id}`)} />
            ))}
          </Rows>
        </>
      ) : null}
      {loaded.state === "ready" && tab === "paid" && paid.length === 0 ? <EmptyCard words="No paid orders yet" /> : null}
      {loaded.state === "ready" && tab === "paid" && paid.length > 0 ? (
        <Rows>
          {paid.map((o) => (
            <ListRow key={o.id} title={o.picker} meta={orderMeta(o)} end={kes(orderTotal(o))} onClick={() => navigate(`/orders/${o.id}`)} />
          ))}
        </Rows>
      ) : null}
    </Shell>
  );
}
