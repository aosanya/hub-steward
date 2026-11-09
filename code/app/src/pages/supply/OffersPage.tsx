import { useNavigate } from "react-router-dom";
import { doSomethingPath } from "../../routes";
import { useLoad } from "../../forms/useLoad";
import { isApproved, mcpSupplyClient, mySupplier, buyerPriceWords, priceWords, resolveMember, type SupplyClient } from "../../supply/api";
import { Button } from "../../ui/Button";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { ListRow, Rows } from "../../ui/ListRow";
import { BuyerTabs } from "../../sell/buyer/BuyerTabs";
import { mcpBuyerAskClient, waitingAsks, type BuyerAskClient } from "../../sell/group/buyerAsksApi";
import { Shell } from "../../ui/Shell";

type Props = { client?: SupplyClient; asks?: BuyerAskClient; me?: string; buyer?: boolean };

export function OffersPage({ client = mcpSupplyClient, asks = mcpBuyerAskClient, me, buyer = false }: Props) {
  const navigate = useNavigate();
  const base = buyer ? "/prices" : "/offers";
  const offers = useLoad(async () => {
    const mine = mySupplier(await client.listSuppliers(), await resolveMember(me));
    if (!isApproved(mine)) return null;
    return client.listOffers(mine!.id);
  }, "offers");
  const waiting = useLoad(async () => (buyer ? waitingAsks(await asks.list(me).catch(() => [])) : []), "offers-waiting-asks");
  return (
    <Shell title={buyer ? "Your prices" : "Offers"} onBack={() => navigate(doSomethingPath())}>
      {buyer ? <BuyerTabs active="prices" /> : null}
      {waiting.state === "ready" && waiting.data.length > 0 ? (
        <>
          <h2>Asks waiting · {waiting.data.length}</h2>
          <Rows>
            {waiting.data.map((ask) => (
              <ListRow key={ask.id} title={ask.asker} meta={ask.question} end="›" onClick={() => navigate(`/sell/asks/${ask.id}`)} />
            ))}
          </Rows>
        </>
      ) : null}
      {offers.state === "error" ? <LoadFailed words={buyer ? "Your prices could not be loaded." : "Your offers could not be loaded."} /> : null}
      {offers.state === "ready" && offers.data === null ? (
        <EmptyCard words={buyer ? "Prices open once the group coordinator approves your application." : "Offers open once the group coordinator approves your application."}>
          <Button kind="primary" onClick={() => navigate("/supply/apply")}>
            Your application
          </Button>
        </EmptyCard>
      ) : null}
      {offers.state === "ready" && offers.data && offers.data.length === 0 ? (
        <EmptyCard words={buyer ? "No prices yet" : "No offers yet"}>
          <p>Farmers see the prices you post, so they do not need to ask.</p>
          <Button kind="primary" onClick={() => navigate(`${base}/new`)}>
            {buyer ? "Post a price" : "Add an offer"}
          </Button>
        </EmptyCard>
      ) : null}
      {offers.state === "ready" && offers.data && offers.data.length > 0 ? (
        <>
          <h2>{buyer ? "Prices" : "Offers"} · {offers.data.length}</h2>
          <Rows>
            {offers.data.map((o) => (
              <ListRow key={o.id} title={o.product} meta={buyer ? buyerPriceWords(o) : priceWords(o)} end="›" onClick={() => navigate(`${base}/${o.id}`)} />
            ))}
          </Rows>
          <Button kind="primary" onClick={() => navigate(`${base}/new`)}>
            {buyer ? "Post a price" : "Add an offer"}
          </Button>
          {buyer ? null : <Button onClick={() => navigate("/stock")}>Stock list</Button>}
        </>
      ) : null}
    </Shell>
  );
}
