import { agencyBasePath, openAgencyId } from "../agency/open";
import { allIssuesId } from "./api";

export const tagParam = "tag";

export const queryParam = "q";

const backlogsPath = () => `${agencyBasePath(openAgencyId())}/backlogs`;

export const searchOf = (tags: string[], query = "") => {
  const params = new URLSearchParams(tags.map((tag) => [tagParam, tag]));
  if (query.trim() !== "") params.set(queryParam, query);
  return params;
};

const withTags = (path: string, tags: string[], query = "") => {
  const search = searchOf(tags, query).toString();
  return search ? `${path}?${search}` : path;
};

export const backlogsHomePath = () => backlogsPath();

export const issuesPath = (backlogId: string = allIssuesId, tags: string[] = [], query = "") => withTags(`${backlogsPath()}/${encodeURIComponent(backlogId)}`, tags, query);

export const boardPath = (backlogId: string, tags: string[] = [], query = "") => withTags(`${backlogsPath()}/${encodeURIComponent(backlogId)}/board`, tags, query);

export const issuePath = (id: string) => `${backlogsPath()}/issue/${encodeURIComponent(id)}`;

export const addReferencePath = (id: string) => `${issuePath(id)}/references/add`;
