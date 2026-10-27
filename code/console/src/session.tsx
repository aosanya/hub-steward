import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Hub } from "./types";
import { onSignedOut } from "./wakala/mcp";
import { restoreHubs, signOut as signOutOfWakala } from "./wakala/rest";

type Session = {
  signedIn: boolean;
  expired: boolean;
  hubs: Hub[];
  startSession: (hubs: Hub[]) => void;
  updateHub: (hub: Hub) => void;
  addHub: (hub: Hub) => void;
  signOut: () => Promise<void>;
  restore: () => Promise<boolean>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [expired, setExpired] = useState(false);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const signedInNow = useRef(false);

  const startSession = useCallback((next: Hub[]) => {
    signedInNow.current = true;
    setHubs(next);
    setExpired(false);
    setSignedIn(true);
  }, []);
  const updateHub = useCallback((hub: Hub) => setHubs((all) => all.map((h) => (h.id === hub.id ? hub : h))), []);
  const addHub = useCallback((hub: Hub) => setHubs((all) => all.concat(hub)), []);
  const signOut = useCallback(async () => {
    await signOutOfWakala();
    signedInNow.current = false;
    setHubs([]);
    setSignedIn(false);
  }, []);
  const restore = useCallback(async () => {
    const restored = await restoreHubs();
    if (!restored) return false;
    startSession(restored);
    return true;
  }, [startSession]);

  useEffect(
    () =>
      onSignedOut(() => {
        if (!signedInNow.current) return;
        signedInNow.current = false;
        setHubs([]);
        setSignedIn(false);
        setExpired(true);
      }),
    [],
  );

  const value = useMemo(
    () => ({ signedIn, expired, hubs, startSession, updateHub, addHub, signOut, restore }),
    [signedIn, expired, hubs, startSession, updateHub, addHub, signOut, restore],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession needs a SessionProvider");
  return s;
}
