export const readKept = <T>(key: string, fallback: T, valid: (value: unknown) => boolean): T => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return valid(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
};

export const writeKept = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
};

export const removeKept = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    return;
  }
};
