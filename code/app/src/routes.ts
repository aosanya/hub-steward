import { openAgencyId } from "./agency/open";
import { assistantPaths } from "./assistant/routePaths";
import { chatPaths } from "./chat/routePaths";
import { consentPaths } from "./consent/routePaths";
import { councilPaths } from "./council/routePaths";
import { formsPaths } from "./forms/routePaths";
import { groupsPaths } from "./groups/routePaths";
import { marketPaths } from "./market/routePaths";
import { menuPaths } from "./menu/routePaths";
import { risksPaths } from "./risks/routePaths";
import type { AgencyScreen } from "./screen";
import { stepsPaths } from "./steps/routePaths";
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
