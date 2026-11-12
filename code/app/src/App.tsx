import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AnswerPage } from "./pages/forms/AnswerPage";
import { FormsPage } from "./pages/forms/FormsPage";
import { AgenciesPage } from "./pages/entry/AgenciesPage";
import { InAgency, ToOpenAgency, ToOpenAgencyScreen } from "./pages/entry/OpenAgency";
import { SignInLinkPage } from "./pages/entry/SignInLinkPage";
import { SignInPage } from "./pages/entry/SignInPage";
import { LanguagePage } from "./account/LanguagePage";
import { ProfilePage } from "./account/ProfilePage";
import { SignOutPage } from "./account/SignOutPage";
import { InboxPage } from "./pages/InboxPage";
import { EvidencePage } from "./risks/EvidencePage";
import { RiskPage } from "./risks/RiskPage";
import { RisksPage } from "./risks/RisksPage";
import { AssistantPage } from "./assistant/AssistantPage";
import { AskPage } from "./pages/chat/AskPage";
import { ChatPage } from "./pages/chat/ChatPage";
import { MarketPage } from "./pages/market/MarketPage";
import { ProductPage } from "./pages/market/ProductPage";
import { AsksPage } from "./supply/asks/AsksPage";
import { JoinPage } from "./pages/join/JoinPage";
import { BacklogsRoutes } from "./backlogs";
import { TabPage } from "./pages/TabPage";
import { ApplyPage } from "./pages/supply/ApplyPage";
import { OfferFormPage } from "./pages/supply/OfferFormPage";
import { OffersPage } from "./pages/supply/OffersPage";
import { OrderPage } from "./supply/orders/OrderPage";
import { OrdersPage } from "./supply/orders/OrdersPage";
import { SupplierHome } from "./supply/SupplierHome";
import { StockPage } from "./supply/stock/StockPage";
import { GroupOrderPage, GroupOrdersPage, ReviseGroupOrderPage } from "./supply/groupOrder/GroupOrderPages";
import { AddPaymentPage, CoordinatorOrderPage, ManagePaymentsPage } from "./coordinator/payments/PaymentsPages";
import { BuyNowPage } from "./buy/now/BuyNowPage";
import { BuyOrderPage } from "./buy/now/BuyOrderPage";
import { BoughtOrderPage } from "./buy/join/BoughtOrderPage";
import { GroupOrderPage as BuyGroupOrderPage } from "./buy/join/GroupOrderPage";
import { JoinPage as JoinGroupOrderPage } from "./buy/join/JoinPage";
import { AskShopsPage } from "./buy/wanted/AskShopsPage";
import { AskedPage } from "./buy/wanted/AskedPage";
import { NoticePage } from "./buy/wanted/NoticePage";
import { WantedPage } from "./buy/wanted/WantedPage";
import { MyOrderPage } from "./buy/orders/MyOrderPage";
import { MyOrdersPage } from "./buy/orders/MyOrdersPage";
import { sellNowRoutes } from "./sell/now/routes";
import { JoinSalePage } from "./sell/group/JoinSalePage";
import { AskRoutePage, BuyerAskPage, BuyerAsksPage } from "./sell/group/BuyerAsksPages";
import { AppThreadPage } from "./apps/thread/AppThreadPage";
import { buyInputsSource } from "./apps/thread/marketSource";
import { sellHarvestSource } from "./apps/thread/sellSource";
import { RoomThreadPage } from "./chat/rooms/RoomThreadPage";
import { RoomThreadsPage } from "./chat/rooms/RoomThreadsPage";
import { StartPage } from "./coordinator/start/StartPages";
import { StepPage } from "./steps/StepPage";
import { SessionGate } from "./entry/SessionGate";
import { agencyHomePath } from "./agency/open";
import { allScreens, routes } from "./routes";
import { agencyRoute, backlogsTab, homeTab, ongoingTab, retiredInboxRoute, retiredStartedRoute, tabPathIn, tabRoute, tabs, type Tab } from "./tabs";


function ToAgencyOngoing() {
  const { agencyId = "" } = useParams();
  return <Navigate to={tabPathIn(ongoingTab, agencyId)} replace />;
}

function ToAgencyHome() {
  const { agencyId = "" } = useParams();
  const { search, state } = useLocation();
  return <Navigate to={`${agencyHomePath(agencyId)}${search}`} state={state} replace />;
}

function tabElement(tab: Tab) {
  if (tab.id === "home") return <InboxPage />;
  if (tab.id === "do-something") return <SupplierHome segment="start" />;
  if (tab.id === "ongoing") return <SupplierHome segment="ongoing" />;
  if (tab.id === "chat") return <ChatPage />;
  return <TabPage tab={tab} />;
}

export function App() {
  return (
    <SessionGate>
    <Routes>
      {tabs.map((tab) => (
        <Route key={tab.id} path={tab.path} element={<ToOpenAgency tab={tab} />} />
      ))}
      <Route path={backlogsTab.path} element={<ToOpenAgency tab={backlogsTab} />} />
      <Route path="/started" element={<ToOpenAgency tab={ongoingTab} />} />
      <Route path="/inbox" element={<ToOpenAgency tab={homeTab} />} />
      <Route path={agencyRoute} element={<InAgency><Outlet /></InAgency>}>
        <Route index element={<ToAgencyHome />} />
        <Route path={retiredStartedRoute} element={<ToAgencyOngoing />} />
        <Route path={retiredInboxRoute} element={<ToAgencyHome />} />
        {tabs.map((tab) => (
          <Route key={`in-${tab.id}`} path={tabRoute(tab)} element={tabElement(tab)} />
        ))}
        <Route path={`${backlogsTab.segment}/*`} element={<BacklogsRoutes />} />
        <Route path={routes.join.pattern} element={<JoinPage />} />
        <Route path={routes.start.pattern} element={<StartPage />} />
        <Route path={routes.step.pattern} element={<StepPage />} />
        <Route path={routes.market.pattern} element={<MarketPage />} />
        <Route path={routes.product.pattern} element={<ProductPage />} />
        <Route path={routes.buyNow.pattern} element={<BuyNowPage />} />
        <Route path={routes.marketOrder.pattern} element={<BuyOrderPage />} />
        <Route path={routes.boughtOrder.pattern} element={<BoughtOrderPage />} />
        <Route path={routes.groupOrder.pattern} element={<BuyGroupOrderPage />} />
        <Route path={routes.joinGroupOrder.pattern} element={<JoinGroupOrderPage />} />
        <Route path={routes.forms.pattern} element={<FormsPage />} />
        <Route path={routes.form.pattern} element={<AnswerPage />} />
        <Route path={routes.assistant.pattern} element={<AssistantPage />} />
        <Route path={routes.roomThreads.pattern} element={<RoomThreadsPage />} />
        <Route path={routes.roomThread.pattern} element={<RoomThreadPage heading="thread" />} />
        <Route path={routes.ask.pattern} element={<AskPage />} />
        <Route path={routes.risks.pattern} element={<RisksPage />} />
        <Route path={routes.risk.pattern} element={<RiskPage />} />
        <Route path={routes.riskEvidence.pattern} element={<EvidencePage />} />
      </Route>
      {allScreens.map((screen) => (
        <Route key={screen.retired} path={screen.retired} element={<ToOpenAgencyScreen screen={screen} />} />
      ))}
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
      <Route path="/apps/buy" element={<AppThreadPage appName="Buy inputs" source={buyInputsSource} backTo="/do-something" backLabel="Do Something" />} />
      <Route path="/apps/sell" element={<AppThreadPage appName="Sell harvest" source={sellHarvestSource} backTo="/do-something" backLabel="Do Something" />} />
      <Route path="/asks" element={<AsksPage />} />
      <Route path="/asks/:askId" element={<AskRoutePage />} />
      <Route path="/supply/apply" element={<ApplyPage />} />
      <Route path="/offers" element={<OffersPage />} />
      <Route path="/prices" element={<OffersPage buyer />} />
      <Route path="/prices/new" element={<OfferFormPage buyer />} />
      <Route path="/prices/:offerId" element={<OfferFormPage buyer />} />
      <Route path="/stock" element={<StockPage />} />
      <Route path="/offers/new"element={<OfferFormPage />} />
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
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-in/link" element={<SignInLinkPage />} />
      <Route path="/agencies" element={<AgenciesPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/language" element={<LanguagePage />} />
      <Route path="/sign-out" element={<SignOutPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </SessionGate>
  );
}
