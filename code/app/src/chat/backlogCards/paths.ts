import { agencyBasePath } from "../../agency/open";

export const backlogsPath = (agencyId: string) => `${agencyBasePath(agencyId)}/backlogs`;

export const allIssuesPath = (agencyId: string) => `${backlogsPath(agencyId)}/all`;

export const backlogPath = (agencyId: string, backlogId: string) => `${backlogsPath(agencyId)}/${encodeURIComponent(backlogId)}`;
