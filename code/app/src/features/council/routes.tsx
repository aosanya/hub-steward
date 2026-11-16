import { Route } from "react-router-dom";
import { CouncilRisksPage } from "./CouncilRisksPage";
import { LateMattersPage } from "./LateMattersPage";
import { councilPaths } from "./routePaths";

export const councilRoutes = () => (
  <>
    <Route path={councilPaths.lateMatters.pattern} element={<LateMattersPage />} />
    <Route path={councilPaths.councilRisks.pattern} element={<CouncilRisksPage />} />
  </>
);
