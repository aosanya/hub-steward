import { Route } from "react-router-dom";
import { ApplicationScreen } from "./ApplicationScreen";
import { FeesPaymentsScreen, LicencesScreen, PermitsScreen, ServiceCatalogueScreen } from "./ServicesScreens";
import { servicesPaths } from "./paths";

export { ApplicationScreen, FeesPaymentsScreen, LicencesScreen, PermitsScreen, ServiceCatalogueScreen };
export { servicesPaths } from "./paths";

export const items = [
  { title: "Permits", path: () => servicesPaths.permits.path() },
  { title: "Licences", path: () => servicesPaths.licences.path() },
  { title: "Fees & Payments", path: () => servicesPaths.fees.path() },
  { title: "Service Catalogue", path: () => servicesPaths.catalogue.path() },
];

export const routes = () => (
  <>
    <Route path={servicesPaths.permits.pattern} element={<PermitsScreen />} />
    <Route path={servicesPaths.licences.pattern} element={<LicencesScreen />} />
    <Route path={servicesPaths.fees.pattern} element={<FeesPaymentsScreen />} />
    <Route path={servicesPaths.catalogue.pattern} element={<ServiceCatalogueScreen />} />
    <Route path={servicesPaths.application.pattern} element={<ApplicationScreen />} />
  </>
);
