import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AnswerPage } from "./forms/AnswerPage";
import { FormsPage } from "./forms/FormsPage";
import { AgenciesPage } from "./entry/AgenciesPage";
import { InAgency, ToOpenAgency, ToOpenAgencyScreen } from "./entry/OpenAgency";
import { SignInLinkPage } from "./entry/SignInLinkPage";
import { SignInPage } from "./entry/SignInPage";
import { ConsentGate } from "./consent/ConsentGate";
import { ConsentPage } from "./consent/ConsentPage";
import { LanguagePage } from "./account/LanguagePage";
import { ProfilePage } from "./account/ProfilePage";
import { SignOutPage } from "./account/SignOutPage";
import { NotificationsPage } from "./inbox/NotificationsPage";
import { CouncilRisksPage } from "./council/CouncilRisksPage";
import { LateMattersPage } from "./council/LateMattersPage";
import { EvidencePage } from "./risks/EvidencePage";
import { RiskPage } from "./risks/RiskPage";
import { RisksPage } from "./risks/RisksPage";
import { AssistantPage } from "./assistant/AssistantPage";
import { AskPage } from "./chat/AskPage";
import { ChatPage } from "./chat/ChatPage";
import { MarketPage } from "./market/product/MarketPage";
import { ProductPage } from "./market/product/ProductPage";
import { AsksPage } from "./market/supply/asks/AsksPage";
import { JoinPage } from "./groups/JoinPage";
import { BacklogsRoutes } from "./backlogs";
import { FilesRoutes, filesSegment } from "./files";
import { TabPage } from "./shared/ui/TabPage";
import { ApplyPage } from "./market/supply/ApplyPage";
import { OfferFormPage } from "./market/supply/OfferFormPage";
import { OffersPage } from "./market/supply/OffersPage";
import { OrderPage } from "./market/supply/orders/OrderPage";
import { OrdersPage } from "./market/supply/orders/OrdersPage";
import { SupplierHome } from "./market/supply/SupplierHome";
import { HomeOptions } from "./home/HomeOptions";
import { MenuRows } from "./menu/MenuRows";
import { SectionPage } from "./menu/SectionPage";
import { NeedsYouStrip } from "./home/NeedsYouStrip";
import { StockPage } from "./market/supply/stock/StockPage";
import { GroupOrderPage, GroupOrdersPage, ReviseGroupOrderPage } from "./market/supply/groupOrder/GroupOrderPages";
import { AddPaymentPage, CoordinatorOrderPage, ManagePaymentsPage } from "./market/payments/PaymentsPages";
import { BuyNowPage } from "./market/buy/now/BuyNowPage";
import { BuyOrderPage } from "./market/buy/now/BuyOrderPage";
import { BoughtOrderPage } from "./market/buy/join/BoughtOrderPage";
import { GroupOrderPage as BuyGroupOrderPage } from "./market/buy/join/GroupOrderPage";
import { JoinPage as JoinGroupOrderPage } from "./market/buy/join/JoinPage";
import { AskShopsPage } from "./market/buy/wanted/AskShopsPage";
import { AskedPage } from "./market/buy/wanted/AskedPage";
import { NoticePage } from "./market/buy/wanted/NoticePage";
import { WantedPage } from "./market/buy/wanted/WantedPage";
import { MyOrderPage } from "./market/buy/orders/MyOrderPage";
import { MyOrdersPage } from "./market/buy/orders/MyOrdersPage";
import { sellNowRoutes } from "./market/sell/now/routes";
import { JoinSalePage } from "./market/sell/group/JoinSalePage";
import { AskRoutePage, BuyerAskPage, BuyerAsksPage } from "./market/sell/group/BuyerAsksPages";
import { AppThreadPage } from "./apps/thread/AppThreadPage";
import { buyInputsSource } from "./apps/thread/marketSource";
import { sellHarvestSource } from "./apps/thread/sellSource";
import { RoomThreadPage } from "./chat/rooms/RoomThreadPage";
import { RoomThreadsPage } from "./chat/rooms/RoomThreadsPage";
import { StartPage } from "./market/start/StartPages";
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
  if (tab.id === "home") return <NotificationsPage above={<><NeedsYouStrip /><HomeOptions /><MenuRows /></>} />;
  if (tab.id === "notifications") return <NotificationsPage />;
  if (tab.id === "start") return <SupplierHome segment="start" />;
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
      <Route path={agencyRoute} element={<InAgency><ConsentGate><Outlet /></ConsentGate></InAgency>}>
        <Route index element={<ToAgencyHome />} />
        <Route path={retiredStartedRoute} element={<ToAgencyOngoing />} />
        <Route path={retiredInboxRoute} element={<ToAgencyHome />} />
        {tabs.map((tab) => (
          <Route key={`in-${tab.id}`} path={tabRoute(tab)} element={tabElement(tab)} />
        ))}
        <Route path={`${backlogsTab.segment}/*`} element={<BacklogsRoutes />} />
        <Route path={`${filesSegment}/*`} element={<FilesRoutes />} />
        <Route path={routes.consent.pattern} element={<ConsentPage />} />
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
        <Route path={routes.lateMatters.pattern} element={<LateMattersPage />} />
        <Route path={routes.councilRisks.pattern} element={<CouncilRisksPage />} />
        <Route path={routes.menu.pattern} element={<SectionPage />} />
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
