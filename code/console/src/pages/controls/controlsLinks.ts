import { hubPath } from "../../api";

export const controlsHref = (hubId: string, target: { add?: boolean; control?: string } = {}) =>
  hubPath(hubId, "controls") + (target.add ? "?add=control" : target.control ? "?control=" + encodeURIComponent(target.control) : "");
