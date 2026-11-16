import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { InAgency, ToOpenAgency, ToOpenAgencyScreen } from "../features/entry/OpenAgency";
import { ConsentGate } from "../features/consent/ConsentGate";
import { consentRoutes } from "../features/consent";
import { groupsRoutes } from "../features/groups";
import { stepsRoutes } from "../features/steps";
import { menuRoutes } from "./menu";
import { formsRoutes } from "../features/forms";
import { chatRoutes } from "../features/chat";
import { risksRoutes } from "../features/risks";
import { councilRoutes } from "../features/council";
import { assistantRoutes } from "../features/assistant";
import { marketRoutes, marketStandaloneRoutes } from "../features/market";
import { appsRoutes } from "../features/apps";
import { entryRoutes } from "../features/entry";
import { accountRoutes } from "../features/account";
import { NotificationsPage } from "../features/inbox/NotificationsPage";
import { ChatPage } from "../features/chat/ChatPage";
import { BacklogsRoutes } from "../features/backlogs";
import { FilesRoutes, filesSegment } from "../features/files";
import { TabPage } from "./TabPage";
import { SupplierHome } from "../features/market/supply/SupplierHome";
import { HomeOptions } from "./home/HomeOptions";
import { MenuRows } from "./menu/MenuRows";
import { NeedsYouStrip } from "./home/NeedsYouStrip";
import { SessionGate } from "../features/entry/SessionGate";
import { agencyHomePath } from "../shared/wakala/openAgency";
import { allScreens } from "./routes";
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
        {consentRoutes()}
        {groupsRoutes()}
        {stepsRoutes()}
        {assistantRoutes()}
        {menuRoutes()}
        {formsRoutes()}
        {chatRoutes()}
        {risksRoutes()}
        {councilRoutes()}
        {marketRoutes()}
      </Route>
      {allScreens.map((screen) => (
        <Route key={screen.retired} path={screen.retired} element={<ToOpenAgencyScreen screen={screen} />} />
      ))}
      {marketStandaloneRoutes()}
      {appsRoutes()}
      {entryRoutes()}
      {accountRoutes()}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </SessionGate>
  );
}
