import { useEffect, useRef } from "react";
import { onRegainFocus } from "../../inbox/regainFocus";

export const refreshMilliseconds = 15000;

export function useQuietRefresh(refresh: () => void, paused: boolean) {
  const latest = useRef(refresh);
  const held = useRef(paused);
  latest.current = refresh;
  held.current = paused;

  useEffect(() => {
    const run = () => {
      if (!held.current) latest.current();
    };
    const timer = setInterval(run, refreshMilliseconds);
    const stop = onRegainFocus(run);
    return () => {
      clearInterval(timer);
      stop();
    };
  }, []);
}
