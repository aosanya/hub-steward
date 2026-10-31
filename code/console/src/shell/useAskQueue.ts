import { useCallback, useMemo, useRef, useState } from "react";
import type { Ask, Told } from "./chatTell";

export function useAskQueue(hubId: string) {
  const [waiting, setWaiting] = useState<Told[]>([]);
  const last = useRef(0);

  const ask: Ask = useCallback(
    (text, background, afterChange, settled, shown) => {
      last.current += 1;
      const next = { hubId, id: last.current, text, background, afterChange, settled, shown };
      setWaiting((now) => [...now, next]);
    },
    [hubId],
  );

  const fill = useCallback(
    (text: string) => {
      last.current += 1;
      const next: Told = { hubId, id: last.current, text, typed: true };
      setWaiting((now) => [...now, next]);
    },
    [hubId],
  );

  const take = useCallback((id: number) => setWaiting((now) => now.filter((item) => item.id !== id)), []);

  const cancel = useCallback(
    (id: number) => {
      waiting.find((item) => item.id === id)?.settled?.();
      take(id);
    },
    [waiting, take],
  );

  const cancelAll = useCallback(() => {
    waiting.forEach((item) => item.settled?.());
    setWaiting([]);
  }, [waiting]);

  const queue = useMemo(() => waiting.filter((item) => item.hubId === hubId), [waiting, hubId]);

  return { queue, ask, fill, take, cancel, cancelAll };
}
