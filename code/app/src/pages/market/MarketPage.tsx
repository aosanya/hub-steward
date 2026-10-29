import { useNavigate } from "react-router-dom";
import { mcpMarketClient, type MarketClient } from "../../market/api";
import { useLoad } from "../../forms/useLoad";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { ListRow, Rows } from "../../ui/ListRow";
import { doSomethingPath, routes } from "../../routes";
import { ProductRows } from "../../ui/ProductRows";
import { Shell } from "../../ui/Shell";

export function MarketPage({ client = mcpMarketClient }: { client?: MarketClient }) {
  const navigate = useNavigate();
  const products = useLoad(() => client.listProducts(), "products");
  return (
    <Shell title="Market" onBack={() => navigate(doSomethingPath())}>
      {products.state === "error" ? <LoadFailed words="The market could not be loaded." /> : null}
      {products.state === "ready" && products.data.length === 0 ? <EmptyCard words="Nothing is listed yet." /> : null}
      {products.state === "ready" && products.data.length > 0 ? (
        <ProductRows products={products.data} onOpen={(productId) => navigate(routes.product.path({ productId }))} />
      ) : null}
      <Rows>
        <ListRow title="Something not listed" end="›" onClick={() => navigate("/buy/wanted")} />
        <ListRow title="My orders" end="›" onClick={() => navigate("/my-orders")} />
      </Rows>
    </Shell>
  );
}
