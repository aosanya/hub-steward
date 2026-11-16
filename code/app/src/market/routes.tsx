import { Route } from "react-router-dom";
import { BoughtOrderPage } from "./buy/join/BoughtOrderPage";
import { GroupOrderPage as BuyGroupOrderPage } from "./buy/join/GroupOrderPage";
import { JoinPage as JoinGroupOrderPage } from "./buy/join/JoinPage";
import { BuyNowPage } from "./buy/now/BuyNowPage";
import { BuyOrderPage } from "./buy/now/BuyOrderPage";
import { MyOrderPage } from "./buy/orders/MyOrderPage";
import { MyOrdersPage } from "./buy/orders/MyOrdersPage";
import { AskShopsPage } from "./buy/wanted/AskShopsPage";
import { AskedPage } from "./buy/wanted/AskedPage";
import { NoticePage } from "./buy/wanted/NoticePage";
import { WantedPage } from "./buy/wanted/WantedPage";
import { AddPaymentPage, CoordinatorOrderPage, ManagePaymentsPage } from "./payments/PaymentsPages";
import { MarketPage } from "./product/MarketPage";
import { ProductPage } from "./product/ProductPage";
import { marketPaths } from "./routePaths";
import { AskRoutePage, BuyerAskPage, BuyerAsksPage } from "./sell/group/BuyerAsksPages";
import { JoinSalePage } from "./sell/group/JoinSalePage";
import { sellNowRoutes } from "./sell/now/routes";
import { StartPage } from "./start/StartPages";
import { ApplyPage } from "./supply/ApplyPage";
import { OfferFormPage } from "./supply/OfferFormPage";
import { OffersPage } from "./supply/OffersPage";
import { AsksPage } from "./supply/asks/AsksPage";
import { GroupOrderPage, GroupOrdersPage, ReviseGroupOrderPage } from "./supply/groupOrder/GroupOrderPages";
import { OrderPage } from "./supply/orders/OrderPage";
import { OrdersPage } from "./supply/orders/OrdersPage";
import { StockPage } from "./supply/stock/StockPage";

export const marketRoutes = () => (
  <>
    <Route path={marketPaths.start.pattern} element={<StartPage />} />
    <Route path={marketPaths.market.pattern} element={<MarketPage />} />
    <Route path={marketPaths.product.pattern} element={<ProductPage />} />
    <Route path={marketPaths.buyNow.pattern} element={<BuyNowPage />} />
    <Route path={marketPaths.marketOrder.pattern} element={<BuyOrderPage />} />
    <Route path={marketPaths.boughtOrder.pattern} element={<BoughtOrderPage />} />
    <Route path={marketPaths.groupOrder.pattern} element={<BuyGroupOrderPage />} />
    <Route path={marketPaths.joinGroupOrder.pattern} element={<JoinGroupOrderPage />} />
  </>
);

export const marketStandaloneRoutes = () => (
  <>
    <Route path="/buy/wanted" element={<WantedPage />} />
    <Route path="/buy/wanted/:requestId/ask" element={<AskShopsPage />} />
    <Route path="/buy/wanted/:requestId" element={<AskedPage />} />
    <Route path="/buy/notices/:noticeId" element={<NoticePage />} />
    <Route path="/my-orders" element={<MyOrdersPage />} />
    <Route path="/my-orders/:orderId" element={<MyOrderPage />} />
    <Route path="/my-orders/group/:groupOrderId" element={<MyOrderPage group />} />
    {sellNowRoutes}
    <Route path="/sell/group/:orderId" element={<JoinSalePage />} />
    <Route path="/sell/asks" element={<BuyerAsksPage />} />
    <Route path="/sell/asks/:askId" element={<BuyerAskPage />} />
    <Route path="/asks" element={<AsksPage />} />
    <Route path="/asks/:askId" element={<AskRoutePage />} />
    <Route path="/supply/apply" element={<ApplyPage />} />
    <Route path="/offers" element={<OffersPage />} />
    <Route path="/prices" element={<OffersPage buyer />} />
    <Route path="/prices/new" element={<OfferFormPage buyer />} />
    <Route path="/prices/:offerId" element={<OfferFormPage buyer />} />
    <Route path="/stock" element={<StockPage />} />
    <Route path="/offers/new" element={<OfferFormPage />} />
    <Route path="/offers/:offerId" element={<OfferFormPage />} />
    <Route path="/orders" element={<OrdersPage />} />
    <Route path="/orders/:orderId" element={<OrderPage />} />
    <Route path="/coordinator/orders/:orderId" element={<CoordinatorOrderPage />} />
    <Route path="/coordinator/orders/:orderId/payments" element={<ManagePaymentsPage />} />
    <Route path="/coordinator/orders/:orderId/payments/new" element={<AddPaymentPage />} />
    <Route path="/coordinator/orders/:orderId/payments/:rowId/correct" element={<AddPaymentPage />} />
    <Route path="/group-orders" element={<GroupOrdersPage />} />
    <Route path="/group-orders/:orderId" element={<GroupOrderPage />} />
    <Route path="/group-orders/:orderId/revise" element={<ReviseGroupOrderPage />} />
  </>
);
