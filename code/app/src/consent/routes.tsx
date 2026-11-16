import { Route } from "react-router-dom";
import { ConsentPage } from "./ConsentPage";
import { consentPaths } from "./routePaths";

export const consentRoutes = () => <Route path={consentPaths.consent.pattern} element={<ConsentPage />} />;
