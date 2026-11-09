import { Route } from "react-router-dom";
import { BacklogPage } from "./BacklogPage";
import { backlogPageRoutePath } from "./paths";

export const BacklogPageRoutes = <Route path={backlogPageRoutePath} element={<BacklogPage />} />;

export { BacklogPage } from "./BacklogPage";
export { backlogPagePath, backlogPageRoutePath } from "./paths";
export type { BacklogPageClient } from "./api";
