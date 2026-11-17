import { Route } from "react-router-dom";
import { QuestionScreen } from "./QuestionScreen";
import { pollsPaths } from "./routePaths";

export const pollsRoutes = () => <Route path={pollsPaths.question.pattern} element={<QuestionScreen />} />;
