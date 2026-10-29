import { forgetRuntimeConfig, setRuntimeConfig } from "./config";
import { checkSession, endSession, forgetSubject, loadSubject, subjectNow } from "./me";
import { keepToken, storedToken } from "./token";
import { memberId, resolveMember } from "../supply/api";

const answer = (status: number, body: unknown) => vi.fn().mockResolvedValue({ ok: status === 200, status, json: async () => body });

describe("the signed-in member", () => {
  beforeEach(() => {
    forgetSubject();
    setRuntimeConfig({ wakala: "https://api.example" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    forgetRuntimeConfig();
    window.localStorage.clear();
  });

  it("asks wakala for /me with credentials and caches the subject", async () => {
    const fetcher = answer(200, { subject: "m7", agencies: [] });
    vi.stubGlobal("fetch", fetcher);
    expect(await loadSubject()).toBe("m7");
    expect(await loadSubject()).toBe("m7");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("https://api.example/me", { credentials: "include", headers: {} });
    expect(subjectNow()).toBe("m7");
    expect(memberId()).toBe("m7");
  });

  it("asks for /me as the kept sign-in link token and forgets that token when the session ends", async () => {
    keepToken({ accessToken: "t1", expiresAt: Date.now() + 60_000, refreshToken: null });
    const fetcher = answer(200, { subject: "m7" });
    vi.stubGlobal("fetch", fetcher);
    expect(await checkSession()).toBe("in");
    expect(fetcher).toHaveBeenCalledWith("https://api.example/me", { credentials: "include", headers: { Authorization: "Bearer t1" } });
    endSession();
    expect(storedToken()).toBeNull();
  });

  it("renews a token that ended while the app was closed before asking for /me, and is signed in", async () => {
    keepToken({ accessToken: "t1", expiresAt: Date.now() - 1_000, refreshToken: "r1" });
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/refresh")) return { ok: true, status: 200, json: async () => ({ access_token: "t2", refresh_token: "r2", expires_in: 3600 }) };
      const bearer = (init?.headers as Record<string, string>).Authorization;
      return { ok: bearer === "Bearer t2", status: bearer === "Bearer t2" ? 200 : 401, json: async () => ({ subject: "m7" }) };
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await checkSession()).toBe("in");
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["https://api.example/auth/refresh", "https://api.example/me"]);
    expect(storedToken()).toMatchObject({ accessToken: "t2", refreshToken: "r2" });
  });

  it("is signed out when the renewal is refused, with the token forgotten", async () => {
    keepToken({ accessToken: "t1", expiresAt: Date.now() - 1_000, refreshToken: "r1" });
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: false, status: 401, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetcher);
    expect(await checkSession()).toBe("out");
    expect(storedToken()).toBeNull();
    expect(fetcher.mock.calls[1][1]).toEqual({ credentials: "include", headers: {} });
  });

  it("answers empty and asks again when not signed in", async () => {
    const fetcher = answer(401, {});
    vi.stubGlobal("fetch", fetcher);
    expect(await loadSubject()).toBe("");
    await loadSubject();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("prefers an injected id and falls back to the stored one", async () => {
    vi.stubGlobal("fetch", answer(401, {}));
    expect(await resolveMember("injected")).toBe("injected");
    window.localStorage.setItem("hubsteward.member", "stored");
    expect(await resolveMember()).toBe("stored");
  });
});
