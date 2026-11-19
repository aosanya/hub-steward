import { Route } from "react-router-dom";
import { pollsPaths } from "../../../../features/polls/routePaths";
import { AllIssuesScreen, AssignedToMeScreen, MapViewScreen, ServiceTypesScreen } from "./IssueScreens";
import { IssueScreen } from "./IssueScreen";
import { issuePaths } from "./paths";
import { RoundsByNeighbourhoodScreen } from "./RoundsByNeighbourhoodScreen";
import { SendWishScreen } from "./SendWishScreen";
import { WishesScreen } from "./WishesScreen";

export { WishesScreen } from "./WishesScreen";
export { SendWishScreen } from "./SendWishScreen";
export { AllIssuesScreen, AssignedToMeScreen, MapViewScreen, ServiceTypesScreen } from "./IssueScreens";
export { IssueScreen } from "./IssueScreen";
export { issuePaths } from "./paths";
export { RoundsByNeighbourhoodScreen } from "./RoundsByNeighbourhoodScreen";

export const items = [
  { title: "All Issues", path: () => issuePaths.all.path() },
  { title: "Assigned to Me", path: () => issuePaths.assigned.path() },
  { title: "Map View", path: () => issuePaths.map.path() },
  { title: "Service Types", path: () => issuePaths.serviceTypes.path() },
  { title: "Wishes", path: () => issuePaths.wishes.path() },
  { title: "Send a Wish", path: () => issuePaths.sendWish.path() },
  { title: "Question", module: "voting", path: () => pollsPaths.question.path() },
  { title: "Rounds by Neighbourhood", path: () => issuePaths.rounds.path() },
];

export const routes = () => (
  <>
    <Route path={issuePaths.all.pattern} element={<AllIssuesScreen />} />
    <Route path={issuePaths.issue.pattern} element={<IssueScreen />} />
    <Route path={issuePaths.assigned.pattern} element={<AssignedToMeScreen />} />
    <Route path={issuePaths.map.pattern} element={<MapViewScreen />} />
    <Route path={issuePaths.serviceTypes.pattern} element={<ServiceTypesScreen />} />
    <Route path={issuePaths.wishes.pattern} element={<WishesScreen />} />
    <Route path={issuePaths.sendWish.pattern} element={<SendWishScreen />} />
    <Route path={issuePaths.rounds.pattern} element={<RoundsByNeighbourhoodScreen />} />
  </>
);
