import { StatusView } from "./views/StatusView";
import { ProfileView } from "./views/ProfileView";
import { GoalsView } from "./views/GoalsView";
import { RolesView } from "./views/RolesView";
import { UsersView } from "./views/UsersView";
import { GroupsView } from "./views/GroupsView";
import { AgentsView } from "./views/AgentsView";
import { GeneralView } from "./views/GeneralView";
import { ConsentPage } from "./consent/ConsentPage";
import { DocumentsView } from "./views/DocumentsView";
import { OperationsView } from "./views/OperationsView";
import { NetworkView } from "./views/NetworkView";
import { ActivityView } from "./views/ActivityView";
import { AlertsView } from "./views/AlertsView";
import { WorkflowsView } from "./views/WorkflowsView";
import { TestView } from "./views/TestView";
import { PublishView } from "./views/PublishView";
import { PublishReviewView } from "./views/PublishReviewView";
import { ReviewAreaView } from "./views/ReviewAreaView";
import { ObjectivesView } from "./views/ObjectivesView";
import { RisksRedirect } from "./views/RisksRedirect";
import { RisksView } from "./views/RisksView";
import { ModulesView } from "./views/ModulesView";
import { ControlsView } from "./views/ControlsView";
import { HazardsView } from "./views/HazardsView";
import { ThreatsView } from "./views/ThreatsView";
import { ConsequencesView } from "./views/ConsequencesView";
import { UsageAgentsView, UsageOverviewView, UsageRedirect, UsageWorkView } from "./usage/usageViews";
import { ModelsPage } from "./ModelsPage";
import { AssistantPage } from "./assistant/AssistantPage";
import type { ComponentType } from "react";

export const views: Record<string, ComponentType> = {
  status: StatusView,
  profile: ProfileView,
  goals: GoalsView,
  roles: RolesView,
  risks: RisksRedirect,
  bowties: RisksView,
  hazards: HazardsView,
  threats: ThreatsView,
  consequences: ConsequencesView,
  controls: ControlsView,
  "models-configure": ModelsPage,
  assistant: AssistantPage,
  usage: UsageRedirect,
  "usage-overview": UsageOverviewView,
  "usage-work": UsageWorkView,
  "usage-agents": UsageAgentsView,
  users: UsersView,
  groups: GroupsView,
  agents: AgentsView,
  general: GeneralView,
  consent: ConsentPage,
  documents: DocumentsView,
  operations: OperationsView,
  network: NetworkView,
  activity: ActivityView,
  alerts: AlertsView,
  workflows: WorkflowsView,
  test: TestView,
  modules: ModulesView,
  publish: PublishView,
  "publish-review": PublishReviewView,
  "review-profile": ReviewAreaView,
  "review-goals": ReviewAreaView,
  "review-objectives": ReviewAreaView,
  "review-roles": ReviewAreaView,
  "review-workflows": ReviewAreaView,
  "review-risks": ReviewAreaView,
  "review-tests": ReviewAreaView,
  objectives: ObjectivesView,
};
