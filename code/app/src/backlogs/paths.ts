import { agencyBasePath, openAgencyId } from "../agency/open";
import { allIssuesId } from "./api";

export const tagParam = "tag";

const backlogsPath = () => `${agencyBasePath(openAgencyId())}/backlogs`;

const withTags = (path: string, tags: string[]) => {
  const search = new URLSearchParams(tags.map((tag) => [tagParam, tag])).toString();
  return search ? `${path}?${search}` : path;
};

export const backlogsHomePath = () => backlogsPath();

export const issuesPath = (backlogId: string = allIssuesId, tags: string[] = []) => withTags(`${backlogsPath()}/${encodeURIComponent(backlogId)}`, tags);

export const boardPath = (backlogId: string, tags: string[] = []) => withTags(`${backlogsPath()}/${encodeURIComponent(backlogId)}/board`, tags);

export const issuePath = (id: string) => `${backlogsPath()}/issue/${encodeURIComponent(id)}`;
