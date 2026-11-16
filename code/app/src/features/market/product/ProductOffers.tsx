import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type MarketClient, type Offer } from "../shared/api";
import { kes } from "../shared/money";
import { useLoad } from "../../forms/useLoad";
import { routes } from "../../../app/routes";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { LoadFailed } from "../../../shared/ui/LoadState";

const firstShown = 2;

const perUnit = (unit: string) => (unit ? ` a ${unit}` : "");

const ofUnit = (unit: string) => (unit ? ` ${unit}s` : "");

const bulkWords = (offer: Offer) =>
  `Bulk price ${kes(offer.bulkPrice)}${perUnit(offer.unit)}${offer.bulkFrom ? ` from ${offer.bulkFrom}${ofUnit(offer.unit)}` : ""}`;

const moreShops = (count: number) => `Show ${count} more ${count === 1 ? "shop" : "shops"}`;

export function useProduct(client: MarketClient, productId: string) {
  return useLoad(async () => {
    const [offers, groupOrders, products] = await Promise.all([
      client.listOffers(productId),
      client.listGroupOrders(productId),
      client.listProducts(),
    ]);
    return { offers, groupOrders, name: products.find((p) => p.id === productId)?.name ?? "" };
  }, productId);
}

type Loaded = ReturnType<typeof useProduct>;

export function ProductOffers({ loaded, productId }: { loaded: Loaded; productId: string }) {
  const navigate = useNavigate();
  const [shown, setShown] = useState(firstShown);
  return (
    <>
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
    </>
  );
}

export function ChosenProduct({ client, productId }: { client: MarketClient; productId: string }) {
  const loaded = useProduct(client, productId);
  return (
    <>
      <h2 className="wf-head">{loaded.state === "ready" ? loaded.data.name || "Market" : "Market"}</h2>
      <div className="wf-content">
        <ProductOffers key={productId} loaded={loaded} productId={productId} />
      </div>
    </>
  );
}
