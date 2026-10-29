import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";
import { priceWords, quantityWords } from "../../market/unitWords";
import { bulkWords, groupSaleLine, mcpSellClient, nameOfProduct, statusOf, type SellClient } from "./api";
import { mcpOpenSales, type OpenSalesClient } from "./openSales";

export function SellPage({ client = mcpSellClient, sales = mcpOpenSales }: { client?: SellClient; sales?: OpenSalesClient }) {
  const { productId = "" } = useParams();
  const navigate = useNavigate();
  const loaded = useLoad(async () => {
    const [prices, groupSales] = await Promise.all([client.listPrices(productId), client.listGroupSales(productId)]);
    return { prices, groupSales };
  }, productId);
  const openSales = useLoad(() => sales.listOpenSales(productId).catch(() => []), `sales-${productId}`);
  const name = loaded.state === "ready" ? nameOfProduct(productId, loaded.data.prices) : productId;

  return (
    <Shell title={loaded.state === "ready" ? name : "Sell harvest"} onBack={() => navigate("/sell")}>
      {loaded.state === "error" ? <LoadFailed words="The buyers' prices could not be loaded." /> : null}
      {loaded.state === "ready" && loaded.data.prices.length === 0 ? <EmptyCard words="No buyer has posted a price yet." /> : null}
      {loaded.state === "ready"
        ? loaded.data.prices.map((offer) => {
            const group = loaded.data.groupSales.find((sale) => sale.buyerId === offer.buyerId);
            return (
              <Card key={offer.id}>
                <p className="ttl">{offer.buyer}</p>
                <p>{offer.words}</p>
                <p>{priceWords(offer.price, offer.unit)}</p>
                {bulkWords(offer) ? <p>{bulkWords(offer)}</p> : null}
                <Button kind="primary" onClick={() => navigate(`/sell/${productId}/now/${offer.id}`)}>
                  Sell now
                </Button>
                {group ? (
                  <>
                    <p>{groupSaleLine(group)}</p>
                    <Button onClick={() => navigate(`/sell/group/${group.id}`)}>Join</Button>
                  </>
                ) : null}
              </Card>
            );
          })
        : null}
      {openSales.state === "ready" && openSales.data.length > 0 ? (
        <>
          <h2>Your sales</h2>
          <Rows>
            {openSales.data.map((sale) => (
              <ListRow
                key={sale.id}
                title={`${quantityWords(sale.quantity, sale.unit)} of ${name}`}
                meta={`${sale.buyer} · ${statusOf(sale)}`}
                onClick={() => navigate(`/sell/sale/${sale.id}`)}
              />
            ))}
          </Rows>
        </>
      ) : null}
    </Shell>
  );
}
