import { useCallback, useSyncExternalStore } from "react";
import { onRegainFocus } from "./regainFocus";

export type SharedRead<T> = { value: T | null; failed: boolean };

type Watch<T> = { state: SharedRead<T>; listeners: Set<() => void>; reading: boolean; stopWatchingFocus: () => void };

const unknown: SharedRead<never> = { value: null, failed: false };

export function sharedRead<C extends object, T>(read: (client: C) => Promise<T>) {
  const watches = new Map<C, Watch<T>>();

  const settle = (watch: Watch<T>, state: SharedRead<T>) => {
    watch.state = state;
    watch.reading = false;
    watch.listeners.forEach((listener) => listener());
  };

  const run = (client: C, watch: Watch<T>) => {
    if (watch.reading) return;
    watch.reading = true;
    Promise.resolve()
      .then(() => read(client))
      .then(
        (value) => settle(watch, { value, failed: false }),
        () => settle(watch, { value: watch.state.value, failed: true }),
      );
  };

  const join = (client: C, listener: () => void) => {
    let watch = watches.get(client);
    if (!watch) {
      const created: Watch<T> = { state: unknown, listeners: new Set(), reading: false, stopWatchingFocus: () => undefined };
      created.stopWatchingFocus = onRegainFocus(() => run(client, created));
      watches.set(client, created);
      run(client, created);
      watch = created;
    }
    const joined = watch;
    joined.listeners.add(listener);
    return () => {
      joined.listeners.delete(listener);
      if (joined.listeners.size === 0 && watches.get(client) === joined) {
        joined.stopWatchingFocus();
        watches.delete(client);
      }
    };
  };

  return function useRead(client: C) {
    const subscribe = useCallback((listener: () => void) => join(client, listener), [client]);
    const state = useSyncExternalStore(subscribe, () => watches.get(client)?.state ?? unknown);
    const refresh = useCallback(() => {
      const watch = watches.get(client);
      if (watch) run(client, watch);
    }, [client]);
    return { ...state, refresh };
  };
}
