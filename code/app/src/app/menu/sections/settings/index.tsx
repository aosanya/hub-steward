import { Route } from "react-router-dom";
import { AiAgents } from "./AiAgents";
import { AiLimitsEditScreen } from "./AiLimitsEditScreen";
import { AgencyProfile } from "./AgencyProfile";
import { AuditLog } from "./AuditLog";
import { BoundariesAndAreas } from "./BoundariesAndAreas";
import { BoundaryEditScreen } from "./BoundaryEditScreen";
import { Integrations } from "./Integrations";
import { settingsPaths } from "./paths";
import { RegisterDetails } from "./RegisterDetails";
import { UsersAndRoles } from "./UsersAndRoles";
import type { MenuItem } from "../../sections";

export const items: MenuItem[] = [
  { title: "Agency Profile", path: () => settingsPaths.agencyProfile.path() },
  { title: "Users & Roles", path: () => settingsPaths.usersAndRoles.path() },
  { title: "Boundaries & Areas", path: () => settingsPaths.boundariesAndAreas.path() },
  { title: "Integrations", path: () => settingsPaths.integrations.path() },
  { title: "AI Agents & Limits", path: () => settingsPaths.aiAgents.path() },
  { title: "Audit Log", path: () => settingsPaths.auditLog.path() },
  { title: "Details of a record", path: () => settingsPaths.registerDetails.path() },
];

export const routes = () => (
  <>
    <Route path={settingsPaths.agencyProfile.pattern} element={<AgencyProfile />} />
    <Route path={settingsPaths.usersAndRoles.pattern} element={<UsersAndRoles />} />
    <Route path={settingsPaths.boundariesAndAreas.pattern} element={<BoundariesAndAreas />} />
    <Route path={settingsPaths.boundaryEdit.pattern} element={<BoundaryEditScreen />} />
    <Route path={settingsPaths.integrations.pattern} element={<Integrations />} />
    <Route path={settingsPaths.aiAgents.pattern} element={<AiAgents />} />
    <Route path={settingsPaths.aiAgentEdit.pattern} element={<AiLimitsEditScreen />} />
    <Route path={settingsPaths.auditLog.pattern} element={<AuditLog />} />
    <Route path={settingsPaths.registerDetails.pattern} element={<RegisterDetails />} />
  </>
);
