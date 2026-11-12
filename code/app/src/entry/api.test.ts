import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetRuntimeConfig, setRuntimeConfig } from "../wakala/config";
import * as mcp from "../wakala/mcp";
import { keepToken } from "../wakala/token";
import { httpEntryClient, looksLikeAnAddress } from "./api";

const respond = (status: number, body?: unknown) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new Error("no body");
      return body;
    },
  });

beforeEach(() => setRuntimeConfig({ wakala: "https://w.example" }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  forgetRuntimeConfig();
});

describe("what looks like an address", () => {
  it.each(["a@b", "grace@example.org"])("accepts %s", (email) => expect(looksLikeAnAddress(email)).toBe(true));
  it.each(["", "grace", "grace@", "@example.org", "gr ace@example.org", "a@b c"])("refuses %j", (email) =>
    expect(looksLikeAnAddress(email)).toBe(false),
  );
});

describe("asking for a sign-in link", () => {
  it("refuses a bad address without calling the server", async () => {
    const fetcher = respond(202);
    vi.stubGlobal("fetch", fetcher);
    expect(await httpEntryClient.sendSignInLink("nope", "/x")).toBe("invalid");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("posts the address and where to return to", async () => {
    const fetcher = respond(202);
    vi.stubGlobal("fetch", fetcher);
    expect(await httpEntryClient.sendSignInLink("g@example.org", "https://app/back")).toBe("sent");
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://w.example/auth/magic-link");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body)).toEqual({ email: "g@example.org", redirect_to: "https://app/back" });
  });

  it("sends the kept token as a bearer beside the cookie", async () => {
    keepToken({ accessToken: "t1", expiresAt: Date.now() + 60_000, refreshToken: null });
    const fetcher = respond(202);
    vi.stubGlobal("fetch", fetcher);
    await httpEntryClient.sendSignInLink("g@example.org", "/x");
    const [, init] = fetcher.mock.calls[0];
    expect(init.headers).toEqual({ Authorization: "Bearer t1", "Content-Type": "application/json" });
    expect(init.credentials).toBe("include");
    window.localStorage.clear();
  });

  it.each([
    [400, "invalid"],
    [429, "busy"],
    [500, "unavailable"],
    [200, "unavailable"],
    [401, "unavailable"],
  ])("answers %i as %s", async (status, outcome) => {
    vi.stubGlobal("fetch", respond(status));
    expect(await httpEntryClient.sendSignInLink("g@example.org", "/x")).toBe(outcome);
  });

  it("answers offline when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await httpEntryClient.sendSignInLink("g@example.org", "/x")).toBe("offline");
  });
});

describe("listing her agencies", () => {
  afterEach(() => window.localStorage.clear());

  it("reads her own agencies, at any role, from her list with the cookie and the token", async () => {
    keepToken({ accessToken: "t1", expiresAt: Date.now() + 60_000, refreshToken: null });
    const fetcher = respond(200, { agencies: [{ id: "a1", name: "Alpha", role: "resident" }, { id: "a2", name: "Beta", role: "owner" }] });
    vi.stubGlobal("fetch", fetcher);
    expect(await httpEntryClient.listAgencies()).toEqual([
      { id: "a1", name: "Alpha" },
      { id: "a2", name: "Beta" },
    ]);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://w.example/me/agencies");
    expect(init.credentials).toBe("include");
    expect(init.headers).toEqual({ Authorization: "Bearer t1" });
  });

  it("lists only the agencies whose name holds the one the app is limited to, in any case", async () => {
    setRuntimeConfig({ wakala: "https://w.example", agency: "zöld" });
    vi.stubGlobal("fetch", respond(200, { agencies: [{ id: "a1", name: "Hub Steward SWE" }, { id: "a2", name: "Zöldhalom Town Council" }] }));
    expect(await httpEntryClient.listAgencies()).toEqual([{ id: "a2", name: "Zöldhalom Town Council" }]);
  });

  it("renews a token within a minute of its end first, and reads her agencies as the new one", async () => {
    keepToken({ accessToken: "t1", expiresAt: Date.now() + 30_000, refreshToken: "r1" });
    const fetcher = vi.fn(async (url: string, _init?: RequestInit) =>
      url.endsWith("/auth/refresh")
        ? { ok: true, status: 200, json: async () => ({ access_token: "t2", refresh_token: "r2", expires_in: 3600 }) }
        : { ok: true, status: 200, json: async () => ({ agencies: [{ id: "a1", name: "Alpha" }] }) },
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await httpEntryClient.listAgencies()).toEqual([{ id: "a1", name: "Alpha" }]);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["https://w.example/auth/refresh", "https://w.example/me/agencies"]);
    expect(fetcher.mock.calls[1][1]?.headers).toEqual({ Authorization: "Bearer t2" });
  });

  it("lists none for a body with no agencies, and fills missing fields with empty text", async () => {
    vi.stubGlobal("fetch", respond(200, { agencies: [] }));
    expect(await httpEntryClient.listAgencies()).toEqual([]);
    vi.stubGlobal("fetch", respond(200, { nothing: true }));
    expect(await httpEntryClient.listAgencies()).toEqual([]);
    vi.stubGlobal("fetch", respond(200, { agencies: [{}] }));
    expect(await httpEntryClient.listAgencies()).toEqual([{ id: "", name: "" }]);
  });

  it("throws when wakala-api does not answer", async () => {
    vi.stubGlobal("fetch", respond(503));
    await expect(httpEntryClient.listAgencies()).rejects.toThrow("your agencies answered 503");
  });

  it.each([401, 403])("tells whoever watches for refusals when it answers %i", async (status) => {
    vi.stubGlobal("fetch", respond(status));
    const refused = vi.fn();
    const stop = mcp.onRefused(refused);
    await expect(httpEntryClient.listAgencies()).rejects.toThrow();
    stop();
    expect(refused).toHaveBeenCalledTimes(1);
  });

  it("does not tell them when it answers something else", async () => {
    vi.stubGlobal("fetch", respond(500));
    const refused = vi.fn();
    const stop = mcp.onRefused(refused);
    await expect(httpEntryClient.listAgencies()).rejects.toThrow();
    stop();
    expect(refused).not.toHaveBeenCalled();
  });
});

describe("searching the directory", () => {
  it("encodes the query", async () => {
    const fetcher = respond(200, []);
    vi.stubGlobal("fetch", fetcher);
    await httpEntryClient.searchDirectory("a&b c");
    expect(fetcher.mock.calls[0][0]).toBe("https://w.example/directory?q=a%26b%20c");
  });

  it("reads a bare array or an items envelope", async () => {
    vi.stubGlobal("fetch", respond(200, [{ id: "a1", name: "Alpha" }]));
    expect((await httpEntryClient.searchDirectory("x")).map((a) => a.id)).toEqual(["a1"]);
    vi.stubGlobal("fetch", respond(200, { items: [{ id: "a2", name: "Beta" }] }));
    expect((await httpEntryClient.searchDirectory("x")).map((a) => a.id)).toEqual(["a2"]);
  });

  it("returns none for a body with neither", async () => {
    vi.stubGlobal("fetch", respond(200, { nothing: true }));
    expect(await httpEntryClient.searchDirectory("x")).toEqual([]);
    vi.stubGlobal("fetch", respond(200, null));
    expect(await httpEntryClient.searchDirectory("x")).toEqual([]);
  });

  it("fills missing fields with empty text and asks to join by approval", async () => {
    vi.stubGlobal("fetch", respond(200, [{}, { id: "a", name: "A", description: "Tools", join_mode: "open" }, { id: "b", purpose: "P", join_mode: "weird" }]));
    expect(await httpEntryClient.searchDirectory("x")).toEqual([
      { id: "", name: "", kind: "", purpose: "", joinMode: "approval" },
      { id: "a", name: "A", kind: "", purpose: "Tools", joinMode: "open" },
      { id: "b", name: "", kind: "", purpose: "P", joinMode: "approval" },
    ]);
  });

  it("throws when the directory does not answer", async () => {
    vi.stubGlobal("fetch", respond(503));
    await expect(httpEntryClient.searchDirectory("x")).rejects.toThrow("directory answered 503");
  });
});

describe("joining an agency", () => {
  it("posts to the encoded agency id", async () => {
    const fetcher = respond(200, { status: "joined" });
    vi.stubGlobal("fetch", fetcher);
    await httpEntryClient.join("a/b c");
    expect(fetcher.mock.calls[0][0]).toBe("https://w.example/instances/a%2Fb%20c/join");
    expect(fetcher.mock.calls[0][1].method).toBe("POST");
  });

  it.each([
    [200, { status: "joined" }, "joined"],
    [200, { status: "requested" }, "requested"],
    [202, { status: "whatever" }, "requested"],
    [200, undefined, "joined"],
    [202, undefined, "requested"],
    [403, { status: "joined" }, "failed"],
    [500, undefined, "failed"],
  ])("answers %i %j as %s", async (status, body, outcome) => {
    vi.stubGlobal("fetch", respond(status, body));
    expect(await httpEntryClient.join("a1")).toBe(outcome);
  });

  it("fails when the network does", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("x")));
    expect(await httpEntryClient.join("a1")).toBe("failed");
  });
});
