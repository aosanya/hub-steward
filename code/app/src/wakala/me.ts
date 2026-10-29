import { runtimeConfig } from "./config";
import { renewedAuthHeaders } from "./renewal";
import { forgetToken } from "./token";

let known: Promise<string> | null = null;
let cached = "";

const fetchSubject = async (): Promise<string> => {
  try {
    const { wakala } = await runtimeConfig();
    const res = await fetch(`${wakala}/me`, { credentials: "include", headers: await renewedAuthHeaders() });
    if (!res.ok) return "";
    const body = await res.json();
    return typeof body?.subject === "string" ? body.subject : "";
  } catch {
    return "";
  }
};

export const loadSubject = (): Promise<string> => {
  known ??= fetchSubject().then((subject) => {
    if (subject === "") known = null;
    else cached = subject;
    return subject;
  });
  return known;
};

export const subjectNow = () => cached;

export const forgetSubject = () => {
  known = null;
  cached = "";
};

export type SessionState = "in" | "out" | "unknown";

const hadSessionKey = "hubsteward.hadSession";

export const hadSession = () => {
  try {
    return window.localStorage.getItem(hadSessionKey) !== null;
  } catch {
    return false;
  }
};

const rememberSession = (had: boolean) => {
  try {
    if (had) window.localStorage.setItem(hadSessionKey, "1");
    else window.localStorage.removeItem(hadSessionKey);
  } catch {
    return;
  }
};

export const checkSession = async (): Promise<SessionState> => {
  try {
    const { wakala } = await runtimeConfig();
    const res = await fetch(`${wakala}/me`, { credentials: "include", headers: await renewedAuthHeaders() });
    if (res.status === 401 || res.status === 403) return "out";
    if (!res.ok) return "unknown";
    rememberSession(true);
    return "in";
  } catch {
    return "unknown";
  }
};

export const endSession = () => {
  forgetSubject();
  forgetToken();
  rememberSession(false);
};
