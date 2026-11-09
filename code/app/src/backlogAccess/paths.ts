import { backlogsHomePath } from "../backlogs/paths";

export const backlogAccessRoutePath = ":backlogId/access";

export const backlogAccessPath = (backlogId: string) => `${backlogsHomePath()}/${encodeURIComponent(backlogId)}/access`;
