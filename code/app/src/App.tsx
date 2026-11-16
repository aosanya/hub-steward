import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { InAgency, ToOpenAgency, ToOpenAgencyScreen } from "./entry/OpenAgency";
import { ConsentGate } from "./consent/ConsentGate";
import { consentRoutes } from "./consent";
import { groupsRoutes } from "./groups";
import { stepsRoutes } from "./steps";
import { menuRoutes } from "./menu";
import { formsRoutes } from "./forms";
import { chatRoutes } from "./chat";
import { risksRoutes } from "./risks";
import { councilRoutes } from "./council";
import { assistantRoutes } from "./assistant";
import { marketRoutes, marketStandaloneRoutes } from "./market";
import { appsRoutes } from "./apps";
import { entryRoutes } from "./entry";
import { accountRoutes } from "./account";
import { NotificationsPage } from "./inbox/NotificationsPage";
import { ChatPage } from "./chat/ChatPage";
import { BacklogsRoutes } from "./backlogs";
import { FilesRoutes, filesSegment } from "./files";
import { TabPage } from "./shared/ui/TabPage";
import { SupplierHome } from "./market/supply/SupplierHome";
import { HomeOptions } from "./home/HomeOptions";
import { MenuRows } from "./menu/MenuRows";
import { NeedsYouStrip } from "./home/NeedsYouStrip";
import { SessionGate } from "./entry/SessionGate";
import { agencyHomePath } from "./agency/open";
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
