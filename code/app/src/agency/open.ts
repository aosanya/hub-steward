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
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    return;
  }
};

export const doSomethingSegment = "do-something";

export const agencyBasePath = (id: string) => `/a/${encodeURIComponent(id)}`;

export const agencyHomePath = (id: string) => `${agencyBasePath(id)}/${doSomethingSegment}`;
