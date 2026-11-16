const storageKey = "hubsteward.token";

export type Token = { accessToken: string; expiresAt: number | null; refreshToken: string | null };

const tokenOf = (value: unknown): Token | null => {
  if (typeof value !== "object" || value === null) return null;
  const { accessToken, expiresAt, refreshToken } = value as Record<string, unknown>;
  if (typeof accessToken !== "string" || accessToken === "") return null;
  if (expiresAt !== null && typeof expiresAt !== "number") return null;
  return { accessToken, expiresAt, refreshToken: typeof refreshToken === "string" && refreshToken !== "" ? refreshToken : null };
};

export const storedToken = (): Token | null => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? tokenOf(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const keepToken = (token: Token) => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(token));
  } catch {
    return;
  }
};

export const forgetToken = () => {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    return;
  }
};

export const renewalMargin = 60_000;

export const hasEnded = (token: Token, now = Date.now()) => token.expiresAt !== null && token.expiresAt <= now;

export const isDue = (token: Token, now = Date.now()) => token.expiresAt !== null && token.expiresAt - renewalMargin <= now;

export const liveToken = (now = Date.now()): Token | null => {
  const token = storedToken();
  return token && !hasEnded(token, now) ? token : null;
};

export const authHeaders = (): Record<string, string> => {
  const token = liveToken();
  return token ? { Authorization: `Bearer ${token.accessToken}` } : {};
};

const secondsOf = (value: string | number | null): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value.trim() === "") return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : null;
};

const expiryOf = (expiresAt: string | number | null, expiresIn: string | number | null, now: number): number | null => {
  const at = secondsOf(expiresAt);
  if (at !== null) return at * 1000;
  const within = secondsOf(expiresIn);
  return within !== null ? now + within * 1000 : null;
};

export const readLinkFragment = (hash: string, now = Date.now()): Token | null => {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  if (params.has("error") || params.has("error_code") || !accessToken) return null;
  return {
    accessToken,
    expiresAt: expiryOf(params.get("expires_at"), params.get("expires_in"), now),
    refreshToken: params.get("refresh_token") || null,
  };
};

const textOf = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);

const numberOf = (value: unknown) => (typeof value === "number" ? value : null);

export const readRefreshReply = (body: unknown, now = Date.now()): Token | null => {
  if (typeof body !== "object" || body === null) return null;
  const reply = body as Record<string, unknown>;
  const accessToken = textOf(reply.access_token);
  const refreshToken = textOf(reply.refresh_token);
  if (accessToken === null || refreshToken === null) return null;
  return { accessToken, expiresAt: expiryOf(numberOf(reply.expires_at), numberOf(reply.expires_in), now), refreshToken };
};
