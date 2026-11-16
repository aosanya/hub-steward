import { Route } from "react-router-dom";
import { StepPage } from "./StepPage";
import { stepsPaths } from "./routePaths";

export const stepsRoutes = () => <Route path={stepsPaths.step.pattern} element={<StepPage />} />;
