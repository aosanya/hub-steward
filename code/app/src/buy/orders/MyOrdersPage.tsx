import { useNavigate } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { routes } from "../../routes";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { Chip, type ChipTone } from "../../ui/Chip";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";
import { kes, resolveMember } from "../../supply/api";
import { kindWords, mcpMyOrdersClient, orderTitle, type MyOrdersClient, type Standing } from "./api";

const tones: Record<Standing, ChipTone | undefined> = {
  Paid: "success",
  Cancelled: undefined,
  Delivered: "info",
  Yes: "success",
  Confirmed: "success",
  "Said yes": "info",
  "Said no": undefined,
  Waiting: "accent",
};

export const StandingChip = ({ standing }: { standing: Standing }) => <Chip tone={tones[standing]}>{standing}</Chip>;

export function MyOrdersPage({ client = mcpMyOrdersClient, me }: { client?: MyOrdersClient; me?: string }) {
  const navigate = useNavigate();
  const orders = useLoad(async () => client.listOrders(await resolveMember(me)), "my-orders");
  return (
    <Shell title="My orders" onBack={() => navigate(routes.market.path())}>
      {orders.state === "error" ? <LoadFailed words="Your orders could not be loaded." /> : null}
      {orders.state === "ready" && orders.data.length === 0 ? <EmptyCard words="No orders yet" /> : null}
      {orders.state === "ready" && orders.data.length > 0 ? (
        <Rows>
          {orders.data.map((o) => (
            <ListRow
              key={`${o.kind}-${o.id}`}
              title={orderTitle(o)}
              meta={`${kindWords(o)} · ${kes(o.unitPrice)} each`}
              end={<StandingChip standing={o.standing} />}
              onClick={() => navigate(o.kind === "group" ? `/my-orders/group/${o.id}` : `/my-orders/${o.id}`)}
            />
          ))}
        </Rows>
      ) : null}
    </Shell>
  );
}
