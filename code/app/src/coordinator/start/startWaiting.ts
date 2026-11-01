import { useCallback, useSyncExternalStore } from "react";
import { mcpStartClient, type StartClient, type StartStep } from "./api";

type Reader = Pick<StartClient, "waiting">;

type Read = StartStep[] | null;

type Watch = { read: Read; listeners: Set<() => void> };

const watches = new Map<Reader, Watch>();

const settle = (watch: Watch, read: StartStep[]) => {
  watch.read = read;
  watch.listeners.forEach((listener) => listener());
};

const begin = (client: Reader): Watch => {
  const watch: Watch = { read: null, listeners: new Set() };
  watches.set(client, watch);
  client.waiting().then(
    (steps) => settle(watch, steps),
    () => settle(watch, []),
  );
  return watch;
};

const join = (client: Reader, listener: () => void) => {
  const watch = watches.get(client) ?? begin(client);
  watch.listeners.add(listener);
  return () => {
    watch.listeners.delete(listener);
    if (watch.listeners.size === 0 && watches.get(client) === watch) watches.delete(client);
  };
};

export function useStartWaiting(client: Reader = mcpStartClient): StartStep[] | null {
  const subscribe = useCallback((listener: () => void) => join(client, listener), [client]);
  return useSyncExternalStore(subscribe, () => watches.get(client)?.read ?? null);
}
