import { screen } from "../../app/screen";

export const risksPaths = {
  risks: screen("/risks"),
  risk: screen("/risks/:riskId"),
  riskEvidence: screen("/risks/:riskId/safeguards/:barrierId/evidence"),
};
