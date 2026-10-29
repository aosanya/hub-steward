import { useNavigate } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { isApproved, mcpSupplyClient, mySupplier, resolveMember, type SupplyClient } from "../../supply/api";
import { Card } from "../../ui/Card";
import { ListRow, Rows } from "../../ui/ListRow";
import { mcpBuyerAskClient, waitingAsks, type BuyerAskClient } from "../group/buyerAsksApi";

type Props = { client?: SupplyClient; askClient?: BuyerAskClient; me?: string };

const waitingWords = (count: number) => (count === 0 ? "None waiting" : `${count} waiting`);

export function BuyerHome({ client = mcpSupplyClient, askClient = mcpBuyerAskClient, me }: Props) {
  const navigate = useNavigate();
  const buyer = useLoad(async () => {
    const mine = mySupplier(await client.listSuppliers(), await resolveMember(me));
    if (!isApproved(mine)) return null;
    const asks = await askClient.list(me).then(waitingAsks, () => null);
    return { waiting: asks === null ? null : asks.length };
  }, "buyer-home");
  if (buyer.state !== "ready" || buyer.data === null) return null;
  return (
    <>
      <h2>Your prices</h2>
      <Card>
        <Rows>
          <ListRow title="Your prices" end="›" onClick={() => navigate("/prices")} />
          <ListRow
            title="Asks waiting"
            meta={buyer.data.waiting === null ? undefined : waitingWords(buyer.data.waiting)}
            end="›"
            onClick={() => navigate("/sell/asks")}
          />
        </Rows>
      </Card>
    </>
  );
}
