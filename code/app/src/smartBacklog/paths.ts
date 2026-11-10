import { backlogsHomePath } from "../backlogs/paths";

export const addSmartBacklogPath = () => `${backlogsHomePath()}/new/smart`;

export const smartBacklogPath = (backlogId: string) => `${backlogsHomePath()}/${encodeURIComponent(backlogId)}/smart`;

export const editRulesPath = (backlogId: string) => `${backlogsHomePath()}/${encodeURIComponent(backlogId)}/rules`;
