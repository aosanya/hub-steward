import { useSyncExternalStore } from "react";

let count = 0;

const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => count;

export const announceDecision = () => {
  count += 1;
  listeners.forEach((listener) => listener());
};

export const useDecisionCount = () => useSyncExternalStore(subscribe, snapshot);
