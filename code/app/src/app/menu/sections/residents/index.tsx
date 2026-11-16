import { Route } from "react-router-dom";
import { AllPeopleScreen, CommunicationsScreen, GroupsScreen, HouseholdsScreen, PersonScreen, RegistrationsScreen } from "./PeopleScreens";
import { residentPaths } from "./paths";

export const items = [
  { title: "All People", path: () => residentPaths.people.path() },
  { title: "Households", path: () => residentPaths.households.path() },
  { title: "Registrations", path: () => residentPaths.registrations.path() },
  { title: "Groups & Associations", path: () => residentPaths.groups.path() },
  { title: "Communications", path: () => residentPaths.communications.path() },
];

export const routes = () => (
  <>
    <Route path={residentPaths.people.pattern} element={<AllPeopleScreen />} />
    <Route path={residentPaths.person.pattern} element={<PersonScreen />} />
    <Route path={residentPaths.households.pattern} element={<HouseholdsScreen />} />
    <Route path={residentPaths.registrations.pattern} element={<RegistrationsScreen />} />
    <Route path={residentPaths.groups.pattern} element={<GroupsScreen />} />
    <Route path={residentPaths.communications.pattern} element={<CommunicationsScreen />} />
  </>
);
