import { useNavigate } from "react-router-dom";
import { doSomethingPath } from "../../routes";
import { useLoad } from "../../forms/useLoad";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { ProductRows } from "../../ui/ProductRows";
import { Shell } from "../../ui/Shell";
import { mcpSellClient, type SellClient } from "./api";

export function SellProductsPage({ client = mcpSellClient }: { client?: SellClient }) {
  const navigate = useNavigate();
  const products = useLoad(() => client.listProducts(), "sell-products");
  return (
    <Shell title="Sell harvest" onBack={() => navigate(doSomethingPath())}>
      {products.state === "error" ? <LoadFailed words="The buyers' prices could not be loaded." /> : null}
      {products.state === "ready" && products.data.length === 0 ? <EmptyCard words="No buyer has posted a price yet." /> : null}
      {products.state === "ready" && products.data.length > 0 ? (
        <ProductRows products={products.data} onOpen={(productId) => navigate(`/sell/${productId}`)} />
      ) : null}
    </Shell>
  );
}
