import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { mcpMarketClient, type MarketClient, type Offer } from "../../market/api";
import { kes } from "../../market/money";
import { useLoad } from "../../forms/useLoad";
import { routes } from "../../routes";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { LoadFailed } from "../../ui/LoadState";
import { Shell } from "../../ui/Shell";

const firstShown = 2;

const perUnit = (unit: string) => (unit ? ` a ${unit}` : "");

const ofUnit = (unit: string) => (unit ? ` ${unit}s` : "");

const bulkWords = (offer: Offer) =>
  `Bulk price ${kes(offer.bulkPrice)}${perUnit(offer.unit)}${offer.bulkFrom ? ` from ${offer.bulkFrom}${ofUnit(offer.unit)}` : ""}`;

const moreShops = (count: number) => `Show ${count} more ${count === 1 ? "shop" : "shops"}`;

export function ProductPage({ client = mcpMarketClient }: { client?: MarketClient }) {
  const { productId = "" } = useParams();
  const navigate = useNavigate();
  const [shown, setShown] = useState(firstShown);
  const loaded = useLoad(async () => {
    const [offers, groupOrders, products] = await Promise.all([
      client.listOffers(productId),
      client.listGroupOrders(productId),
      client.listProducts(),
    ]);
    return { offers, groupOrders, name: products.find((p) => p.id === productId)?.name ?? "" };
  }, productId);

  return (
    <Shell title={loaded.state === "ready" ? loaded.data.name || "Market" : "Market"} onBack={() => navigate(routes.market.path())}>
      {loaded.state === "error" ? <LoadFailed words="The offers could not be loaded." /> : null}
      {loaded.state === "ready"
        ? loaded.data.offers.slice(0, shown).map((offer) => {
            const group = loaded.data.groupOrders.find((g) => g.posterId === offer.posterId);
            return (
              <Card key={offer.id}>
                {offer.shop ? <p className="ttl">{offer.shop}</p> : null}
                <p>{offer.words}</p>
                <p>{`${kes(offer.price)}${perUnit(offer.unit)}`}</p>
                <Button kind="primary" onClick={() => navigate(routes.buyNow.path({ productId, offerId: offer.id }))}>
                  Buy now
                </Button>
                {offer.bulkPrice ? <p>{bulkWords(offer)}</p> : null}
                {group ? (
                  <>
                    <p>{`Group order open ${kes(group.price)}${perUnit(offer.unit)} from ${group.from}${ofUnit(offer.unit)}`}</p>
                    <Button onClick={() => navigate(routes.groupOrder.path({ productId, groupOrderId: group.id }))}>Join</Button>
                  </>
                ) : null}
              </Card>
            );
          })
        : null}
      {loaded.state === "ready" && loaded.data.offers.length > shown ? (
        <Button onClick={() => setShown(shown + firstShown)}>{moreShops(loaded.data.offers.length - shown)}</Button>
      ) : null}
    </Shell>
  );
}
