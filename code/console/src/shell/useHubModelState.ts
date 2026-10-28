import { useEffect, useRef } from "react";
import { listAccounts } from "../data/accounts";
import { hasKey } from "../pages/models/accountMap";
import { useSession } from "../session";
import type { Hub } from "../types";

export const hubModelChanged = "hubsteward:hub-model-changed";

export const announceHubModelChange = () => window.dispatchEvent(new Event(hubModelChanged));

export function useHubModelState(hub: Hub, page: string) {
  const { updateHub } = useSession();
  const latest = useRef(hub);
  const hubId = hub.id;

  useEffect(() => {
    latest.current = hub;
  });

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const accounts = await listAccounts(hubId);
        const current = latest.current;
        if (!live || current.id !== hubId) return;
        const keySet = hasKey(accounts);
        if ((current.model_key_set === true) !== keySet) updateHub({ ...current, model_key_set: keySet });
      } catch {}
    };
    load();
    window.addEventListener(hubModelChanged, load);
    return () => {
      live = false;
      window.removeEventListener(hubModelChanged, load);
    };
  }, [hubId, page, updateHub]);
}
