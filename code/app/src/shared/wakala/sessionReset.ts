const listeners = new Set<() => void>();

export const onSessionReset = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export const announceSessionReset = () => listeners.forEach((listener) => listener());
