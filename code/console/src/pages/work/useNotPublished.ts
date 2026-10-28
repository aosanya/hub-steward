import { changePageOf, isUnpublished, lastPublished } from "../../data/draft";
import { useLoaded } from "../../shell/useLoaded";

export function useNotPublished(hubId: string, kind: string, status: string, decidedAt: string): string | null {
  const page = changePageOf(kind);
  const asks = page !== undefined && status === "approved";
  const { state } = useLoaded(() => (asks ? lastPublished(hubId).then((last) => ({ last })) : Promise.resolve(null)), [hubId, asks]);
  if (!page || state.kind !== "ready" || state.value === null || !isUnpublished(decidedAt, state.value.last)) return null;
  return page;
}
