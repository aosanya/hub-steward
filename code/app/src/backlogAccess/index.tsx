import { Route } from "react-router-dom";
import { BacklogAccessScreen } from "./BacklogAccessScreen";
import { backlogAccessRoutePath } from "./paths";

export const BacklogAccessRoutes = <Route path={backlogAccessRoutePath} element={<BacklogAccessScreen />} />;

export { BacklogAccessScreen } from "./BacklogAccessScreen";
export { backlogAccessPath, backlogAccessRoutePath } from "./paths";
export type { BacklogAccessClient } from "./types";
