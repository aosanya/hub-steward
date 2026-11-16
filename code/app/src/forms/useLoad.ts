import { useEffect, useState } from "react";

export type Loaded<T> = { state: "loading" } | { state: "error" } | { state: "ready"; data: T };

export function useLoad<T>(load: () => Promise<T>, key: string, refreshMs?: number): Loaded<T> {
  const [result, setResult] = useState<Loaded<T>>({ state: "loading" });
  useEffect(() => {
    let live = true;
    setResult({ state: "loading" });
    load().then(
      (data) => live && setResult({ state: "ready", data }),
      () => live && setResult({ state: "error" }),
    );
    const timer = refreshMs
      ? setInterval(() => {
          if (document.hidden) return;
          load().then(
            (data) => live && setResult({ state: "ready", data }),
            () => undefined,
          );
        }, refreshMs)
      : undefined;
    return () => {
      live = false;
      if (timer) clearInterval(timer);
    };
  }, [key, refreshMs]);
  return result;
}
