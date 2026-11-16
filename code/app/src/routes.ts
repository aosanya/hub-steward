import { openAgencyId } from "./features/agency/open";
import { assistantPaths } from "./features/assistant/routePaths";
import { chatPaths } from "./features/chat/routePaths";
import { consentPaths } from "./features/consent/routePaths";
import { councilPaths } from "./features/council/routePaths";
import { formsPaths } from "./features/forms/routePaths";
import { groupsPaths } from "./features/groups/routePaths";
import { marketPaths } from "./features/market/routePaths";
import { menuPaths } from "./menu/routePaths";
import { risksPaths } from "./features/risks/routePaths";
import type { AgencyScreen } from "./screen";
import { stepsPaths } from "./features/steps/routePaths";
import { chatTab, sideReached, startTab, sideTab, tabPathIn } from "./tabs";

export type { AgencyScreen } from "./screen";

export const routes = {
  ...consentPaths,
  ...groupsPaths,
  ...stepsPaths,
  ...assistantPaths,
  ...menuPaths,
  ...formsPaths,
  ...chatPaths,
  ...risksPaths,
  ...councilPaths,
  ...marketPaths,
};

export const allScreens: AgencyScreen[] = Object.values(routes);

export const doSomethingPath = () => tabPathIn(startTab, openAgencyId());

export const doSomethingBackPath = () => tabPathIn(sideTab(sideReached()), openAgencyId());

export const chatListPath = () => tabPathIn(chatTab, openAgencyId());
