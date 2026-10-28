import { useEffect, useState } from "react";
import { listAccounts } from "../data/accounts";
import { hasKey } from "../pages/models/accountMap";
import type { Hub } from "../types";

export type HubStates = Record<string, boolean>;

export const hubWithState = (hub: Hub, states: HubStates): Hub =>
  hub.id in states ? { ...hub, model_key_set: states[hub.id] } : hub;

export function useHubStates(hubs: Hub[]): HubStates {
  const [states, setStates] = useState<HubStates>({});
  const ids = hubs.map((hub) => hub.id);
  const listed = ids.join("\n");

  useEffect(() => {
    let live = true;
    const load = async (id: string) => {
      try {
        const keySet = hasKey(await listAccounts(id));
        if (live) setStates((all) => ({ ...all, [id]: keySet }));
      } catch {}
    };
    ids.forEach(load);
    return () => {
      live = false;
    };
  }, [listed]);

  return states;
}
