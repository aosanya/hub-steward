import { backlogsHomePath } from "../paths";

export const addBacklogPath = () => `${backlogsHomePath()}/new`;

export const editBacklogPath = (backlogId: string) => `${backlogsHomePath()}/${encodeURIComponent(backlogId)}/edit`;
