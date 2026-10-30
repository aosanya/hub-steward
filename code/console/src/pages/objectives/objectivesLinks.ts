import { hubPath } from "../../api";

export type ObjectivesTarget = {
  objective?: string;
  step?: string;
  add?: "objective";
};

export const objectivesHref = (
  hubId: string,
  target: ObjectivesTarget = {},
) => {
  const params = new URLSearchParams();
  if (target.objective) params.set("objective", target.objective);
  if (target.step) params.set("step", target.step);
  if (target.add) params.set("add", target.add);
  const query = params.toString();
  return hubPath(hubId, "objectives") + (query ? `?${query}` : "");
};

export const workflowHref = (hubId: string, workflowId: string) =>
  `${hubPath(hubId, "workflows")}?open=${encodeURIComponent(workflowId)}`;
