import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renewIfDue, renewedAuthHeaders } from "./renewal";
import { renewalMargin, storedToken, keepToken, type Token } from "./token";

type Answer = { status: number; body?: unknown } | "offline" | "hang";

const answering = (...answers: Answer[]) => {
  const fetcher = vi.fn((_url: string, init?: RequestInit) => {
    const answer = answers.shift() ?? { status: 500 };
    if (answer === "offline") return Promise.reject(new TypeError("Failed to fetch"));
    if (answer === "hang")
      return new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError"))));
    return Promise.resolve({
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      json: async () => answer.body,
    });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};

const pair = (over: Record<string, unknown> = {}) => ({
  status: 200,
  body: { access_token: "a-new", refresh_token: "r-new", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, ...over },
});

const endingIn = (ms: number, refreshToken: string | null = "r-old"): Token => ({ accessToken: "a-old", expiresAt: Date.now() + ms, refreshToken });

beforeEach(() => window.localStorage.clear());

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("renewing a kept token", () => {
  it("trades the refresh token at wakala-api when the token is within a minute of its end, and keeps the new pair", async () => {
    keepToken(endingIn(renewalMargin / 2));
    const fetcher = answering(pair());
    expect(await renewIfDue()).toBe("renewed");
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://wakala.test/auth/refresh");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ refresh_token: "r-old" });
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(storedToken()).toMatchObject({ accessToken: "a-new", refreshToken: "r-new" });
    expect(storedToken()?.expiresAt).toBeGreaterThan(Date.now() + 3_500_000);
  });

  it("renews a token that ended already, since its refresh token still works", async () => {
    keepToken(endingIn(-1_000));
    answering(pair());
    expect(await renewIfDue()).toBe("renewed");
    expect(storedToken()?.accessToken).toBe("a-new");
  });

  it("works the new expiry out from expires_in when the reply carries no expires_at", async () => {
    keepToken(endingIn(1_000));
    answering(pair({ expires_at: undefined, expires_in: 1800 }));
    await renewIfDue();
    expect(storedToken()?.expiresAt).toBeGreaterThan(Date.now() + 1_700_000);
    expect(storedToken()?.expiresAt).toBeLessThanOrEqual(Date.now() + 1_800_000);
  });

  it("asks nothing while the token has longer than a minute left", async () => {
    keepToken(endingIn(renewalMargin * 10));
    const fetcher = answering();
    expect(await renewIfDue()).toBe("kept");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("asks nothing for a token with no refresh token or no end", async () => {
    const fetcher = answering();
    keepToken(endingIn(1_000, null));
    expect(await renewIfDue()).toBe("kept");
    keepToken({ accessToken: "a-old", expiresAt: null, refreshToken: "r-old" });
    expect(await renewIfDue()).toBe("kept");
    window.localStorage.clear();
    expect(await renewIfDue()).toBe("kept");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("two calls renewing at once", () => {
  it("send one refresh between them and both read the new token", async () => {
    keepToken(endingIn(1_000));
    const fetcher = answering(pair());
    expect(await Promise.all([renewIfDue(), renewIfDue(), renewedAuthHeaders()])).toEqual(["renewed", "renewed", { Authorization: "Bearer a-new" }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("can ask again once the first renewal is over", async () => {
    keepToken(endingIn(1_000));
    const fetcher = answering(pair({ expires_at: undefined, expires_in: 30 }), pair({ access_token: "a-third", refresh_token: "r-third" }));
    await renewIfDue();
    await renewIfDue();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ refresh_token: "r-new" });
    expect(storedToken()?.accessToken).toBe("a-third");
  });
});

describe("a renewal that is refused", () => {
  it.each([400, 401])("forgets the token when wakala-api answers %i", async (status) => {
    keepToken(endingIn(1_000));
    answering({ status, body: { error: "that session has ended; sign in again" } });
    expect(await renewIfDue()).toBe("ended");
    expect(storedToken()).toBeNull();
  });

  it("sends the call that was waiting with no bearer at all", async () => {
    keepToken(endingIn(-1_000));
    answering({ status: 401 });
    expect(await renewedAuthHeaders()).toEqual({});
  });
});

describe("a renewal that does not get through", () => {
  it.each<[string, Answer]>([
    ["offline", "offline"],
    ["busy", { status: 429, body: { error: "busy" } }],
    ["unanswered", { status: 502, body: { error: "the sign-in service did not answer" } }],
    ["unconfigured", { status: 503, body: { error: "not configured" } }],
    ["answered with something that is not JSON", { status: 200 }],
    ["answered with nothing", { status: 200, body: null }],
  ])("keeps the token for a later try when the refresh is %s", async (_name, answer) => {
    keepToken(endingIn(1_000));
    answering(answer);
    expect(await renewIfDue()).toBe("unreached");
    expect(storedToken()).toMatchObject({ accessToken: "a-old", refreshToken: "r-old" });
  });

  it.each<[string, Record<string, unknown>]>([
    ["no access token", { access_token: undefined }],
    ["an empty access token", { access_token: "" }],
    ["no new refresh token", { refresh_token: undefined }],
    ["an access token that is not text", { access_token: 7 }],
  ])("does not wipe the good token for a reply with %s", async (_name, over) => {
    const kept = endingIn(1_000);
    keepToken(kept);
    answering(pair(over));
    expect(await renewIfDue()).toBe("unreached");
    expect(storedToken()).toEqual(kept);
  });

  it("gives up on a refresh that never answers and keeps the token", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const kept = endingIn(30_000);
    keepToken(kept);
    answering("hang");
    const renewal = renewIfDue();
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await renewal).toBe("unreached");
    expect(storedToken()).toEqual(kept);
  });

  it("sends the old token still while it has not ended, and nothing once it has", async () => {
    keepToken(endingIn(30_000));
    answering("offline", "offline");
    expect(await renewedAuthHeaders()).toEqual({ Authorization: "Bearer a-old" });
    keepToken(endingIn(-1));
    expect(await renewedAuthHeaders()).toEqual({});
  });
});

describe("a token that changed while the refresh was away", () => {
  it("is not brought back when the member signed out meanwhile", async () => {
    keepToken(endingIn(1_000));
    answering(pair());
    const renewal = renewIfDue();
    window.localStorage.clear();
    expect(await renewal).toBe("kept");
    expect(storedToken()).toBeNull();
  });

  it("is not overwritten when another renewal or a new link kept a different token", async () => {
    keepToken(endingIn(1_000));
    answering(pair());
    const renewal = renewIfDue();
    const newer = { accessToken: "a-link", expiresAt: Date.now() + 3_600_000, refreshToken: "r-link" };
    keepToken(newer);
    expect(await renewal).toBe("renewed");
    expect(storedToken()).toEqual(newer);
  });

  it("is not forgotten when the refresh token it was sent with was spent by that other renewal", async () => {
    keepToken(endingIn(1_000));
    answering({ status: 401 });
    const renewal = renewIfDue();
    const newer = { accessToken: "a-other", expiresAt: Date.now() + 3_600_000, refreshToken: "r-other" };
    keepToken(newer);
    expect(await renewal).toBe("renewed");
    expect(storedToken()).toEqual(newer);
  });
});
