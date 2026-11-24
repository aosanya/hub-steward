import { Route } from "react-router-dom";
import { JoinPage } from "./JoinPage";
import { groupsPaths } from "./routePaths";
import { SwitchGroupPage } from "./SwitchGroupPage";

export const groupsRoutes = () => (
  <>
    <Route path={groupsPaths.join.pattern} element={<JoinPage />} />
    <Route path={groupsPaths.switchGroup.pattern} element={<SwitchGroupPage />} />
  </>
);
