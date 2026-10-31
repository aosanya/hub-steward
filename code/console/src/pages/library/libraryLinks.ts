import { hubPath } from "../../api";
import type { LibraryKind } from "../../data/pages/library";
import { kindSetups } from "./libraryKinds";

type Target = { add?: boolean; open?: string; hazard?: string };

export const libraryHref = (hubId: string, kind: LibraryKind, target: Target = {}) => {
  const params = new URLSearchParams();
  if (target.add) params.set("add", "1");
  if (target.open) params.set("open", target.open);
  if (target.hazard) params.set("hazard", target.hazard);
  const query = params.toString();
  return hubPath(hubId, kindSetups[kind].pageId) + (query ? "?" + query : "");
};
