import { useSyncExternalStore } from "react";
import { forgetReads } from "../../shared/wakala/mcp";
import { onSessionReset } from "../../shared/wakala/sessionReset";

let version = 0;
let failed = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export const useMayVersion = () => useSyncExternalStore(subscribe, () => version);

export const useMayFailed = () => useSyncExternalStore(subscribe, () => failed);

export const reportMayFailed = () => {
  if (failed) return;
  failed = true;
  notify();
};

export const retryMay = () => {
  failed = false;
  version += 1;
  forgetReads();
  notify();
};

export const reportMayRead = () => {
  if (!failed) return;
  failed = false;
  notify();
};

onSessionReset(() => {
  failed = false;
  version += 1;
  notify();
});
