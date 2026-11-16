import { Route } from "react-router-dom";
import { JoinPage } from "./JoinPage";
import { groupsPaths } from "./routePaths";

export const groupsRoutes = () => <Route path={groupsPaths.join.pattern} element={<JoinPage />} />;
