import { Route } from "react-router-dom";
import { AssistantPage } from "./AssistantPage";
import { assistantPaths } from "./routePaths";

export const assistantRoutes = () => <Route path={assistantPaths.assistant.pattern} element={<AssistantPage />} />;
