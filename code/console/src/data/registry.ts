import { statusPage } from "./pages/status";
import { agentsPage } from "./pages/agents";
import { usersPage } from "./pages/users";
import { groupsPage } from "./pages/groups";
import { goalsPage } from "./pages/goals";
import { rolesPage } from "./pages/roles";
import { profilePage } from "./pages/profile";
import { generalPage } from "./pages/general";
import { documentsPage } from "./pages/documents";
import { operationsPage } from "./pages/operations";
import { networkPage } from "./pages/network";
import { activityPage } from "./pages/activity";
import { approvalsPage } from "./pages/approvals";
import { alertsPage } from "./pages/alerts";
import { workflowsPage } from "./pages/workflows";
import { risksPage } from "./pages/risks";
import { controlsPage } from "./pages/controls";
import { hazardsPage, threatsPage, consequencesPage } from "./pages/library";
import { testPage } from "./pages/test";
import { publishPage } from "../pages/publish/publishModule";
import { publishReviewPage } from "../pages/publish/publishReviewModule";
import { modulesPage } from "../pages/modules/modulesModule";
import { objectivesPage } from "../pages/objectives/objectivesModule";
import type { PageModule } from "./types";

export const pages: Record<string, PageModule> = {
  status: statusPage,
  agents: agentsPage,
  users: usersPage,
  groups: groupsPage,
  goals: goalsPage,
  risks: risksPage,
  bowties: risksPage,
  hazards: hazardsPage,
  threats: threatsPage,
  consequences: consequencesPage,
  controls: controlsPage,
  roles: rolesPage,
  profile: profilePage,
  general: generalPage,
  documents: documentsPage,
  operations: operationsPage,
  network: networkPage,
  activity: activityPage,
  approvals: approvalsPage,
  alerts: alertsPage,
  workflows: workflowsPage,
  test: testPage,
  modules: modulesPage,
  publish: publishPage,
  "publish-review": publishReviewPage,
  objectives: objectivesPage,
};

export const pageModule = (id: string): PageModule | undefined => pages[id];
