import { runtimeConfig } from "./config";
import { authHeaders, forgetToken, isDue, keepToken, readRefreshReply, storedToken, type Token } from "./token";

export type Renewal = "kept" | "renewed" | "ended" | "unreached";

type Exchange = { kind: "renewed"; token: Token } | { kind: "ended" } | { kind: "unreached" };

const unreached: Exchange = { kind: "unreached" };

const refreshTimeout = 10_000;

const exchange = async (refreshToken: string): Promise<Exchange> => {
  try {
    const { wakala } = await runtimeConfig();
    const res = await fetch(`${wakala}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(refreshTimeout),
    });
    if (res.status === 400 || res.status === 401) return { kind: "ended" };
    if (!res.ok) return unreached;
    const token = readRefreshReply(await res.json());
    return token ? { kind: "renewed", token } : unreached;
  } catch {
    return unreached;
  }
};

const renew = async (refreshToken: string): Promise<Renewal> => {
  const outcome = await exchange(refreshToken);
  const current = storedToken();
  if (current === null) return "kept";
  if (current.refreshToken !== refreshToken) return "renewed";
  if (outcome.kind === "renewed") {
    keepToken(outcome.token);
    return "renewed";
  }
  if (outcome.kind === "ended") {
    forgetToken();
    return "ended";
  }
  return "unreached";
};

let inFlight: Promise<Renewal> | null = null;

export const renewIfDue = (now = Date.now()): Promise<Renewal> => {
  const token = storedToken();
  if (token === null || token.refreshToken === null || !isDue(token, now)) return Promise.resolve("kept");
  const refreshToken = token.refreshToken;
  inFlight ??= renew(refreshToken).finally(() => {
    inFlight = null;
  });
  return inFlight;
};

export const renewedAuthHeaders = async (): Promise<Record<string, string>> => {
  await renewIfDue();
  return authHeaders();
};
