import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { resolveMember } from "../../supply/api";
import { routes } from "../../routes";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { JoinForm } from "../../ui/JoinForm";
import { Shell } from "../../ui/Shell";
import { termsWords, mcpJoinClient, type JoinClient, type OpenGroupOrder } from "./api";

type Props = { client?: JoinClient; me?: string };

function JoinOrder({ client, order, done }: { client: JoinClient; order: OpenGroupOrder; done: () => void }) {
  const send = async (quantity: number) => {
    await client.join(order.id, quantity);
    done();
  };
  return (
    <JoinForm label="How many bags" unit="bag" action="Join" current={order.mine?.quantity} send={send}>
      <p className="meta">{termsWords(order)}</p>
    </JoinForm>
  );
}

export function JoinPage({ client = mcpJoinClient, me }: Props) {
  const navigate = useNavigate();
  const { productId = "", groupOrderId = "" } = useParams();
  const back = routes.groupOrder.path({ productId, groupOrderId });
  const order = useLoad(async () => client.getGroupOrder(groupOrderId, await resolveMember(me)), `join${groupOrderId}`);
  return (
    <Shell title="Join the group order" onBack={() => navigate(back)}>
      {order.state === "error" ? <LoadFailed words="This group order could not be opened." /> : null}
      {order.state === "ready" && order.data.state !== "open" ? <EmptyCard words="This group order is not open to join." /> : null}
      {order.state === "ready" && order.data.state === "open" ? (
        <JoinOrder client={client} order={order.data} done={() => navigate(back)} />
      ) : null}
    </Shell>
  );
}
