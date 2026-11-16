import { Route } from "react-router-dom";
import { AgenciesPage } from "./AgenciesPage";
import { SignInLinkPage } from "./SignInLinkPage";
import { SignInPage } from "./SignInPage";

export const entryRoutes = () => (
  <>
    <Route path="/sign-in" element={<SignInPage />} />
    <Route path="/sign-in/link" element={<SignInLinkPage />} />
    <Route path="/agencies" element={<AgenciesPage />} />
  </>
);
