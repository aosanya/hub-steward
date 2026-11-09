import { backlogsHomePath } from "../backlogs/paths";

export const addBacklogPath = () => `${backlogsHomePath()}/new`;

export const editBacklogPath = (backlogId: string) => `${backlogsHomePath()}/${encodeURIComponent(backlogId)}/edit`;
