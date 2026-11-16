import { Route } from "react-router-dom";
import { AgendaMinutesScreen, agendaMinutesTitle } from "./AgendaMinutesScreen";
import { BylawsScreen, bylawsTitle } from "./BylawsScreen";
import { CommitteesScreen, committeesTitle } from "./CommitteesScreen";
import { MeetingsScreen, meetingsTitle } from "./MeetingsScreens";
import { ResolutionsScreen, resolutionsTitle } from "./ResolutionsScreen";
import { councilPaths } from "./paths";

export const items = [
  { title: meetingsTitle, path: () => councilPaths.meetings.path() },
  { title: agendaMinutesTitle, path: () => councilPaths.agendas.path() },
  { title: resolutionsTitle, path: () => councilPaths.resolutions.path() },
  { title: bylawsTitle, path: () => councilPaths.bylaws.path() },
  { title: committeesTitle, path: () => councilPaths.committees.path() },
];

export const routes = () => (
  <>
    <Route path={councilPaths.meetings.pattern} element={<MeetingsScreen />} />
    <Route path={councilPaths.agendas.pattern} element={<AgendaMinutesScreen />} />
    <Route path={councilPaths.resolutions.pattern} element={<ResolutionsScreen />} />
    <Route path={councilPaths.bylaws.pattern} element={<BylawsScreen />} />
    <Route path={councilPaths.committees.pattern} element={<CommitteesScreen />} />
  </>
);
