import { Route } from "react-router-dom";
import { CommitteesScreen, committeesTitle } from "./CommitteesScreen";
import { councilPaths } from "./paths";

export const items = [{ title: committeesTitle, path: () => councilPaths.committees.path() }];

export const routes = () => <Route path={councilPaths.committees.pattern} element={<CommitteesScreen />} />;
