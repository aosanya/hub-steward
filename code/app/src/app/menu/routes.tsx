import { Route } from "react-router-dom";
import { SectionPage } from "./SectionPage";
import { menuPaths } from "./routePaths";

export const menuRoutes = () => <Route path={menuPaths.menu.pattern} element={<SectionPage />} />;
