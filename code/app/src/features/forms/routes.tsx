import { Route } from "react-router-dom";
import { AnswerPage } from "./AnswerPage";
import { FormsPage } from "./FormsPage";
import { formsPaths } from "./routePaths";

export const formsRoutes = () => (
  <>
    <Route path={formsPaths.forms.pattern} element={<FormsPage />} />
    <Route path={formsPaths.form.pattern} element={<AnswerPage />} />
  </>
);
