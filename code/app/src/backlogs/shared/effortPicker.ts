import type { BacklogsClient, Issue } from "./api";

export const effortPicker = (client: BacklogsClient, reload: () => void) => {
  const set = client.setEffort;
  return (issue: Issue) => (set ? (effort: string) => set(issue.id, effort).then(reload) : undefined);
};
