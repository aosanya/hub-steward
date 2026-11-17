import { Route } from "react-router-dom";
import { routes as appRoutes } from "../../../routes";
import { BusinessNewScreen } from "./BusinessNewScreen";
import { BusinessesScreen } from "./BusinessesScreen";
import { InformalTraderNewScreen } from "./InformalTraderNewScreen";
import { InformalTradersScreen } from "./InformalTradersScreen";
import { AllPeopleScreen, CommunicationsScreen, GroupsScreen, HouseholdsScreen, RegistrationsScreen } from "./PeopleScreens";
import { residentPaths } from "./paths";
import { SearchScreen } from "./SearchScreen";

export const items = [
  { title: "Search", path: () => residentPaths.search.path() },
  { title: "All People", wordIn: "People", path: () => residentPaths.people.path() },
  { title: "Households", path: () => residentPaths.households.path() },
  { title: "Registrations", path: () => residentPaths.registrations.path() },
  { title: "Groups & Associations", path: () => residentPaths.groups.path() },
  { title: "Communications", path: () => residentPaths.communications.path() },
  { title: "Businesses", path: () => residentPaths.businesses.path() },
  { title: "Informal traders", path: () => residentPaths.informalTraders.path() },
];

export const routes = () => (
  <>
    <Route path={residentPaths.search.pattern} element={<SearchScreen />} />
    <Route path={residentPaths.people.pattern} element={<AllPeopleScreen />} />
    <Route path={residentPaths.households.pattern} element={<HouseholdsScreen />} />
    <Route path={residentPaths.registrations.pattern} element={<RegistrationsScreen />} />
    <Route path={residentPaths.groups.pattern} element={<GroupsScreen />} />
    <Route path={residentPaths.communications.pattern} element={<CommunicationsScreen />} />
    <Route path={residentPaths.businesses.pattern} element={<BusinessesScreen />} />
    <Route path={appRoutes.businessNew.pattern} element={<BusinessNewScreen />} />
    <Route path={residentPaths.informalTraders.pattern} element={<InformalTradersScreen />} />
    <Route path={appRoutes.informalTraderNew.pattern} element={<InformalTraderNewScreen />} />
  </>
);
