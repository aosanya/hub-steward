import { backlogsHomePath } from "../shared/paths";

export const backlogAccessRoutePath = ":backlogId/access";

export const backlogAccessPath = (backlogId: string) => `${backlogsHomePath()}/${encodeURIComponent(backlogId)}/access`;
