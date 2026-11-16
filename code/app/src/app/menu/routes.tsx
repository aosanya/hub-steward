import { Route } from "react-router-dom";
import { SectionPage } from "./SectionPage";
import { menuPaths } from "./routePaths";
import { routes as assetRoutes } from "./sections/assets";
import { routes as councilRoutes } from "./sections/council";
import { routes as financeRoutes } from "./sections/finance";
import { routes as issueRoutes } from "./sections/issues";
import { routes as propertyRoutes } from "./sections/properties";
import { routes as residentRoutes } from "./sections/residents";
import { routes as servicesRoutes } from "./sections/services";
import { routes as settingsRoutes } from "./sections/settings";
import { routes as staffRoutes } from "./sections/staff";

export const menuRoutes = () => (
  <>
    <Route path={menuPaths.menu.pattern} element={<SectionPage />} />
    {residentRoutes()}
    {propertyRoutes()}
    {issueRoutes()}
    {servicesRoutes()}
    {assetRoutes()}
    {councilRoutes()}
    {staffRoutes()}
    {financeRoutes()}
    {settingsRoutes()}
  </>
);
