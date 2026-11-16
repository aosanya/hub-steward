import { useNavigate, useParams } from "react-router-dom";
import { mcpMarketClient, type MarketClient } from "../shared/api";
import { useWide } from "../../../shared/ui/useWide";
import { routes } from "../../../app/routes";
import { Shell } from "../../../app/Shell";
import { MarketPage } from "./MarketPage";
import { ProductOffers, useProduct } from "./ProductOffers";

export function ProductPage({ client = mcpMarketClient }: { client?: MarketClient }) {
  const { productId = "" } = useParams();
  const wide = useWide();
  const navigate = useNavigate();
  const loaded = useProduct(client, productId);
  if (wide) return <MarketPage client={client} openedId={productId} />;
  return (
    <Shell title={loaded.state === "ready" ? loaded.data.name || "Market" : "Market"} onBack={() => navigate(routes.market.path())}>
      <ProductOffers loaded={loaded} productId={productId} />
    </Shell>
  );
}
