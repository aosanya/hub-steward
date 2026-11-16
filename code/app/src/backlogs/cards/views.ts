export const backlogViewKind = "backlog_view";

export type BacklogView = { view: "all" } | { view: "backlogs" } | { view: "backlog"; backlogId: string };

const backlogPrefix = "backlog:";

export const backlogViewOf = (targetId: string): BacklogView | null => {
  if (targetId === "all") return { view: "all" };
  if (targetId === "backlogs") return { view: "backlogs" };
  if (targetId.startsWith(backlogPrefix) && targetId.length > backlogPrefix.length) {
    return { view: "backlog", backlogId: targetId.slice(backlogPrefix.length) };
  }
  return null;
};
