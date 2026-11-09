import { agencyBasePath, openAgencyId } from "../agency/open";
import { tagParam } from "../backlogs/paths";

const backlogPath = (backlogId: string) => `${agencyBasePath(openAgencyId())}/backlogs/${encodeURIComponent(backlogId)}`;

export const boardPath = (backlogId: string, tags: string[] = []) => {
  const search = new URLSearchParams(tags.map((tag) => [tagParam, tag])).toString();
  return search ? `${backlogPath(backlogId)}/board?${search}` : `${backlogPath(backlogId)}/board`;
};

export const backlogPagePath = (backlogId: string) => `${backlogPath(backlogId)}/page`;
