import { backlogsHomePath } from "../shared/paths";

export const backlogPageRoutePath = ":backlogId/page";

export const backlogPagePath = (backlogId: string) => `${backlogsHomePath()}/${encodeURIComponent(backlogId)}/page`;
