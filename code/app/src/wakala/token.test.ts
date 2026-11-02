import { authHeaders, forgetToken, hasEnded, isDue, keepToken, liveToken, readLinkFragment, readRefreshReply, renewalMargin, storedToken } from "./token";

const now = 1_800_000_000_000;

describe("reading the fragment of a sign-in link", () => {
  it("takes the token, the refresh token and an expiry given in seconds since 1970", () => {
    expect(readLinkFragment("#access_token=a1&expires_at=1800003600&refresh_token=r1&token_type=bearer", now)).toEqual({
      accessToken: "a1",
      expiresAt: 1_800_003_600_000,
      refreshToken: "r1",
    });
  });

  it("works the expiry out from expires_in when expires_at is absent", () => {
    expect(readLinkFragment("#access_token=a1&expires_in=3600", now)).toEqual({
      accessToken: "a1",
      expiresAt: now + 3_600_000,
      refreshToken: null,
    });
  });

  it("keeps a token with no expiry as one that does not end by the clock", () => {
    expect(readLinkFragment("#access_token=a1", now)?.expiresAt).toBeNull();
  });

  it.each(["", "#", "#refresh_token=r1", "#error=access_denied&error_code=otp_expired", "#access_token=a1&error=x", "#access_token=a1&error_code=otp_expired"])(
    "refuses %j",
    (hash) => expect(readLinkFragment(hash, now)).toBeNull(),
  );
});

describe("reading the reply to a refresh", () => {
  it("takes the new pair and the expiry given in seconds since 1970", () => {
    expect(readRefreshReply({ access_token: "a2", refresh_token: "r2", token_type: "bearer", expires_in: 3600, expires_at: 1800003600 }, now)).toEqual({
      accessToken: "a2",
      expiresAt: 1_800_003_600_000,
      refreshToken: "r2",
    });
  });

  it("works the expiry out from expires_in when expires_at is absent", () => {
    expect(readRefreshReply({ access_token: "a2", refresh_token: "r2", expires_in: 600 }, now)?.expiresAt).toBe(now + 600_000);
  });

  it("keeps a pair with no expiry as one that does not end by the clock, because the old refresh token is spent", () => {
    expect(readRefreshReply({ access_token: "a2", refresh_token: "r2" }, now)).toEqual({ accessToken: "a2", expiresAt: null, refreshToken: "r2" });
  });

  it.each([
    null,
    undefined,
    "text",
    [],
    {},
    { access_token: "a2" },
    { refresh_token: "r2" },
    { access_token: "", refresh_token: "r2" },
    { access_token: "a2", refresh_token: "" },
    { access_token: 2, refresh_token: "r2" },
  ])("refuses %j as no new token", (body) => expect(readRefreshReply(body, now)).toBeNull());
});

describe("when a token is due for renewal", () => {
  it("is due within a minute of its end, and once past it", () => {
    expect(isDue({ accessToken: "a", expiresAt: now + renewalMargin + 1, refreshToken: "r" }, now)).toBe(false);
    expect(isDue({ accessToken: "a", expiresAt: now + renewalMargin, refreshToken: "r" }, now)).toBe(true);
    expect(isDue({ accessToken: "a", expiresAt: now - 1, refreshToken: "r" }, now)).toBe(true);
  });

  it("is never due with no end", () => {
    expect(isDue({ accessToken: "a", expiresAt: null, refreshToken: "r" }, now)).toBe(false);
  });
});

describe("the kept token", () => {
  afterEach(() => window.localStorage.clear());

  it("is kept, read back and forgotten", () => {
    keepToken({ accessToken: "a1", expiresAt: now + 1000, refreshToken: "r1" });
    expect(storedToken()).toEqual({ accessToken: "a1", expiresAt: now + 1000, refreshToken: "r1" });
    forgetToken();
    expect(storedToken()).toBeNull();
  });

  it.each(["not json", "[]", "null", '{"accessToken":""}', '{"accessToken":"a","expiresAt":"soon"}'])("reads %s as no token", (raw) => {
    window.localStorage.setItem("hubsteward.token", raw);
    expect(storedToken()).toBeNull();
  });

  it("has ended once its expiry has passed, and never when it has none", () => {
    expect(hasEnded({ accessToken: "a", expiresAt: now, refreshToken: null }, now)).toBe(true);
    expect(hasEnded({ accessToken: "a", expiresAt: now + 1, refreshToken: null }, now)).toBe(false);
    expect(hasEnded({ accessToken: "a", expiresAt: null, refreshToken: null }, now)).toBe(false);
  });

  it("is live only while it has not ended", () => {
    keepToken({ accessToken: "a1", expiresAt: now + 1000, refreshToken: null });
    expect(liveToken(now)?.accessToken).toBe("a1");
    expect(liveToken(now + 1000)).toBeNull();
  });

  it("is sent as a bearer header while live and as nothing otherwise", () => {
    expect(authHeaders()).toEqual({});
    keepToken({ accessToken: "a1", expiresAt: Date.now() + 60_000, refreshToken: null });
    expect(authHeaders()).toEqual({ Authorization: "Bearer a1" });
    keepToken({ accessToken: "a1", expiresAt: Date.now() - 1, refreshToken: null });
    expect(authHeaders()).toEqual({});
  });

  it("is read as no token when the browser refuses storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(storedToken()).toBeNull();
    vi.restoreAllMocks();
  });
});
