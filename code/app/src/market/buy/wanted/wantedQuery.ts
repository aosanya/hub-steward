import type { Wanted } from "./api";

export const wantedQuery = (wanted: Wanted) =>
  new URLSearchParams({ what: wanted.what, quantity: wanted.quantity, by: wanted.neededBy }).toString();

export const wantedFrom = (params: URLSearchParams): Wanted => ({
  what: params.get("what") ?? "",
  quantity: params.get("quantity") ?? "",
  neededBy: params.get("by") ?? "",
});
