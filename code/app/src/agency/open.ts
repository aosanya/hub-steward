const storageKey = "hubsteward.openAgency";

let openId = "";

const remembered = () => {
  try {
    return sessionStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
};

export const openAgencyId = () => (openId ||= remembered());

let openName = "";

const nameListeners = new Set<() => void>();

export const openAgencyName = () => openName;

export const subscribeAgencyName = (listener: () => void) => {
  nameListeners.add(listener);
  return () => void nameListeners.delete(listener);
};

export const rememberAgencyName = (name: string) => {
  if (name === openName) return;
  openName = name;
  nameListeners.forEach((listener) => listener());
};

export const openAgency = (id: string) => {
  openId = id;
  try {
    sessionStorage.setItem(storageKey, id);
  } catch {
    return;
  }
};

export const forgetOpenAgency = () => {
  openId = "";
  rememberAgencyName("");
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    return;
  }
};

export const homeSegment = "home";

export const doSomethingSegment = "do-something";

export const ongoingSegment = "ongoing";

export const backlogsSegment = "backlogs";

export const agencyBasePath = (id: string) => `/a/${encodeURIComponent(id)}`;

export const agencyHomePath = (id: string) => `${agencyBasePath(id)}/${homeSegment}`;

export const doSomethingPathIn = (id: string) => `${agencyBasePath(id)}/${doSomethingSegment}`;
