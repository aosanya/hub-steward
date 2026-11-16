import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { mcpMarketClient, type MarketClient } from "../shared/api";
import { useLoad } from "../../forms/useLoad";
import { EmptyCard, LoadFailed } from "../../../shared/ui/LoadState";
import { ListRow, Rows } from "../../../shared/ui/ListRow";
import { doSomethingBackPath, routes } from "../../../app/routes";
import { ProductRows } from "../../../shared/ui/ProductRows";
import { useWide } from "../../../shared/ui/useWide";
import { Shell } from "../../../app/Shell";
import { ChosenProduct } from "./ProductOffers";
import "../../../shared/ui/paneWindow.css";

type Props = { client?: MarketClient; openedId?: string };

export function MarketPage({ client = mcpMarketClient, openedId = "" }: Props) {
  const navigate = useNavigate();
  const wide = useWide();
  const [chosen, setChosen] = useState(openedId);
  const products = useLoad(() => client.listProducts(), "products");
  const open = (productId: string) => (wide ? setChosen(productId) : navigate(routes.product.path({ productId })));
  const list: ReactNode = (
    <>
      {products.state === "error" ? <LoadFailed words="The market could not be loaded." /> : null}
      {products.state === "ready" && products.data.length === 0 ? <EmptyCard words="Nothing is listed yet." /> : null}
      {products.state === "ready" && products.data.length > 0 ? <ProductRows products={products.data} onOpen={open} /> : null}
      <Rows>
        <ListRow title="Something not listed" end="›" onClick={() => navigate("/buy/wanted")} />
        <ListRow title="My orders" end="›" onClick={() => navigate("/my-orders")} />
      </Rows>
    </>
  );
  const onBack = () => navigate(doSomethingBackPath());
  if (!wide) {
    return (
      <Shell title="Market" onBack={onBack}>
        {list}
      </Shell>
    );
  }
  return (
    <Shell title="Market" onBack={onBack} tabless>
      <div className="wf">
        <div className="wf-panes">
          <section className="wf-tree" aria-label="Market">
            {list}
          </section>
          <section className="wf-main" aria-label={chosen ? "Product" : undefined}>
            {chosen ? <ChosenProduct key={chosen} client={client} productId={chosen} /> : null}
          </section>
        </div>
        <footer className="wf-status" aria-label="Status bar" />
      </div>
    </Shell>
  );
}
