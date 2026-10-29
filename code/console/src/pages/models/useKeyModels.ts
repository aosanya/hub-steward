import { useEffect, useState } from "react";
import { keyModels } from "../../data/accountModels";

export type KeyModels = {
  phase: "waiting" | "loading" | "loaded" | "failed";
  names: string[];
  reload: () => void;
};

export function useKeyModels(hubId: string, accountId: string | undefined, keyHeld: boolean): KeyModels {
  const [round, setRound] = useState(0);
  const [read, setRead] = useState<{ key: string; names: string[] | null } | null>(null);
  const ready = keyHeld && accountId !== undefined;
  const key = `${hubId}/${accountId}/${round}`;

  useEffect(() => {
    if (!ready || accountId === undefined) return;
    let current = true;
    keyModels(hubId, accountId).then(
      (names) => current && setRead({ key, names }),
      () => current && setRead({ key, names: null }),
    );
    return () => {
      current = false;
    };
  }, [hubId, accountId, ready, round]);

  const reload = () => setRound((r) => r + 1);
  if (!ready) return { phase: "waiting", names: [], reload };
  if (read?.key !== key) return { phase: "loading", names: [], reload };
  return read.names === null ? { phase: "failed", names: [], reload } : { phase: "loaded", names: read.names, reload };
}
