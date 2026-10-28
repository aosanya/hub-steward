import { hubPath } from "../../api";
import { providerOf, type AddStart } from "./catalog";

export const addPathOf = (hubId: string, start?: AddStart) => {
  const path = hubPath(hubId, "models", "new");
  if (!start) return path;
  const query = new URLSearchParams({ provider: start.provider, model: start.model });
  if (start.base !== undefined) query.set("base", start.base);
  return `${path}?${query}`;
};

export const addStartOfQuery = (query: URLSearchParams): AddStart | undefined => {
  const provider = providerOf(query.get("provider") ?? "");
  if (!provider) return undefined;
  return {
    provider: provider.id,
    model: query.get("model") ?? provider.preselected,
    base: query.get("base") ?? provider.baseURL,
  };
};
