import { Route } from "react-router-dom";
import { AskQuestionScreen } from "./AskQuestionScreen";
import { QuestionScreen } from "./QuestionScreen";
import { pollsPaths } from "./routePaths";

export const pollsRoutes = () => (
  <>
    <Route path={pollsPaths.question.pattern} element={<QuestionScreen />} />
    <Route path={pollsPaths.ask.pattern} element={<AskQuestionScreen />} />
  </>
);
