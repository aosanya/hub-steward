import { useCallback, useContext, useEffect, useId, useState } from "react";
import { FailureCtx, failureReason } from "./failureContext";
import { useReportLoading } from "./loadingContext";

export type Loaded<T> = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; value: T };

type Held<T> = { loaded: Loaded<T>; received: number };

export function useLoaded<T>(
  load: () => Promise<T>,
  inputs: readonly unknown[] = [],
): { state: Loaded<T>; reload: () => void; received: number } {
  const [held, setHeld] = useState<Held<T>>({ loaded: { kind: "loading" }, received: 0 });
  const [round, setRound] = useState(0);
  const reportFailure = useContext(FailureCtx);
  const id = useId();

  useEffect(() => () => reportFailure(id, null), [id, reportFailure]);

  useEffect(() => {
    setHeld((before) => (before.loaded.kind === "loading" ? before : { ...before, loaded: { kind: "loading" } }));
  }, [...inputs]);

  useEffect(() => {
    let current = true;
    new Promise<T>((resolve) => resolve(load())).then(
      (value) => {
        if (!current) return;
        reportFailure(id, null);
        setHeld((before) => ({ loaded: { kind: "ready", value }, received: before.received + 1 }));
      },
      (error) => {
        if (!current) return;
        reportFailure(id, failureReason(error));
        setHeld((before) => ({ ...before, loaded: { kind: "failed" } }));
      },
    );
    return () => {
      current = false;
    };
  }, [...inputs, round]);

  useReportLoading(held.loaded.kind === "loading");

  const reload = useCallback(() => setRound((n) => n + 1), []);
  return { state: held.loaded, reload, received: held.received };
}
