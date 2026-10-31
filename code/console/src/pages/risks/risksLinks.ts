import { hubPath } from "../../api";

export const risksHref = (hubId: string, target: { add?: boolean; risk?: string; tab?: "consequences" } = {}) =>
  hubPath(hubId, "bowties") +
  (target.add ? "?add=risk" : target.risk ? "?risk=" + encodeURIComponent(target.risk) + (target.tab ? "&tab=" + target.tab : "") : "");
