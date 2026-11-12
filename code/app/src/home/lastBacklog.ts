import { backlogsSegment, openAgencyId } from "../agency/open";
import { allIssuesId } from "../backlogs/api";

const keyPrefix = "hubsteward.lastBacklog.";

const notBacklogs = new Set([allIssuesId, "new", "issue"]);

export const lastBacklogId = () => {
  try {
    return localStorage.getItem(keyPrefix + openAgencyId()) ?? "";
  } catch {
    return "";
  }
};

export const rememberBacklog = (id: string) => {
  try {
    localStorage.setItem(keyPrefix + openAgencyId(), id);
  } catch {
    return;
  }
};

export const forgetLastBacklogs = () => {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(keyPrefix))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    return;
  }
};

export const backlogIdOfPath = (pathname: string) => {
  const parts = pathname.split("/");
  const at = parts.indexOf(backlogsSegment);
  const id = at < 0 ? "" : decodeURIComponent(parts[at + 1] ?? "");
  return notBacklogs.has(id) ? "" : id;
};
