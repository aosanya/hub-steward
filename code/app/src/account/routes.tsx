import { Route } from "react-router-dom";
import { LanguagePage } from "./LanguagePage";
import { ProfilePage } from "./ProfilePage";
import { SignOutPage } from "./SignOutPage";

export const accountRoutes = () => (
  <>
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/language" element={<LanguagePage />} />
    <Route path="/sign-out" element={<SignOutPage />} />
  </>
);
