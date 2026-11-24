export type AssumedGroup = { agencyId: string; id: string; name: string; count: number };

let held: AssumedGroup | null = null;

const listeners = new Set<() => void>();

const tell = () => listeners.forEach((listener) => listener());

export const assumedGroupNow = () => held;

export const subscribeAssumedGroup = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export const rememberAssumedGroup = (group: AssumedGroup) => {
  held = group;
  tell();
};

export const forgetAssumedGroup = () => {
  if (held === null) return;
  held = null;
  tell();
};
