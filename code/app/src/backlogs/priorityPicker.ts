import type { BacklogsClient, Issue } from "./api";

export const priorityPicker = (client: BacklogsClient, reload: () => void) => {
  const set = client.setPriority;
  return (issue: Issue) => (set ? (priority: string) => set(issue.id, priority).then(reload) : undefined);
};
