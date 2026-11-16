import { Route } from "react-router-dom";
import { EvidencePage } from "./EvidencePage";
import { RiskPage } from "./RiskPage";
import { RisksPage } from "./RisksPage";
import { risksPaths } from "./routePaths";

export const risksRoutes = () => (
  <>
    <Route path={risksPaths.risks.pattern} element={<RisksPage />} />
    <Route path={risksPaths.risk.pattern} element={<RiskPage />} />
    <Route path={risksPaths.riskEvidence.pattern} element={<EvidencePage />} />
  </>
);
