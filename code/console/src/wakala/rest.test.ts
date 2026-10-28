import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setRuntimeConfig } from "./config";
import { callTool, resetMcp } from "./mcp";
import { checkSession, importHub, listHubs, listServices, reasonOf, restoreHubs, serviceNames, signIn, signOut } from "./rest";

vi.mock("./mcp", () => ({ resetMcp: vi.fn(), callTool: vi.fn(async () => ({ items: [] })) }));

type Reply = { status?: number; body?: unknown } | "unreachable";
type Seen = { method: string; url: string; init: RequestInit };

const wakala = "https://wakala.test";

function stubFetch(replies: Record<string, Reply>) {
  const seen: Seen[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      seen.push({ method: String(init.method), url, init });
      const reply = replies[`${init.method} ${url}`];
      if (reply === "unreachable") throw new TypeError("network down");
      const status = reply ? (reply.status ?? 200) : 404;
      return {
        ok: status < 400,
        status,
        json: async () => {
          if (reply?.body === undefined) throw new SyntaxError("no body");
          return reply.body;
        },
      };
    }),
  );
  return seen;
}

beforeEach(() => {
  vi.mocked(resetMcp).mockClear();
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockResolvedValue({ items: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signing in", () => {
  it("posts the email and password to wakala's sign-in with the cookie allowed", async () => {
    const seen = stubFetch({ [`POST ${wakala}/auth/signin`]: { status: 201, body: { expires_at: "later" } } });

    const reply = await signIn({ email: "a@b.c", password: "pw" });

    expect(reply.ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0].init.credentials).toBe("include");
    expect(seen[0].init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(seen[0].init.body))).toEqual({ email: "a@b.c", password: "pw" });
  });

  it("starts the tool session over again once signed in, so the new cookie is used", async () => {
    stubFetch({ [`POST ${wakala}/auth/signin`]: { status: 201, body: {} } });

    await signIn({ email: "a@b.c", password: "pw" });

    expect(resetMcp).toHaveBeenCalledTimes(1);
  });

  it("keeps the tool session when sign-in is refused", async () => {
    stubFetch({ [`POST ${wakala}/auth/signin`]: { status: 401, body: { error: "do not match" } } });

    const reply = await signIn({ email: "a@b.c", password: "bad" });

    expect(reply).toMatchObject({ ok: false, status: 401, data: { error: "do not match" } });
    expect(resetMcp).not.toHaveBeenCalled();
  });
});

describe("signing out", () => {
  it("posts to wakala's sign-out with the cookie allowed and starts the tool session over", async () => {
    const seen = stubFetch({ [`POST ${wakala}/auth/signout`]: { status: 204 } });

    const reply = await signOut();

    expect(reply.ok).toBe(true);
    expect(seen[0].init.credentials).toBe("include");
    expect(resetMcp).toHaveBeenCalledTimes(1);
  });

  it("starts the tool session over even when wakala cannot be reached", async () => {
    stubFetch({ [`POST ${wakala}/auth/signout`]: "unreachable" });

    await expect(signOut()).rejects.toThrow("network down");

    expect(resetMcp).toHaveBeenCalledTimes(1);
  });
});

describe("the session", () => {
  it("asks wakala who is signed in with the cookie allowed and no body", async () => {
    const seen = stubFetch({ [`GET ${wakala}/auth/session`]: { body: { member_id: "m-1" } } });

    const reply = await checkSession();

    expect(reply.ok).toBe(true);
    expect(seen[0].init.credentials).toBe("include");
    expect(seen[0].init.body).toBeUndefined();
    expect(seen[0].init.headers).toBeUndefined();
  });

  it("lists only the hubs the caller owns, with their id, name and role", async () => {
    stubFetch({
      [`GET ${wakala}/instances`]: {
        body: [
          { id: "a", name: "Alpha", role: "owner", table_slug: "t_a" },
          { id: "b", name: "Beta", role: "agent" },
          { id: "c", name: "Gamma", role: "resident" },
          { id: "d", role: "owner" },
          { name: "Nameless id", role: "owner" },
          null,
        ],
      },
    });

    expect(await listHubs()).toEqual([
      { id: "a", name: "Alpha", role: "owner" },
      { id: "d", name: "d", role: "owner" },
    ]);
  });

  it("keeps the kind of each hub, the template it was made from, and leaves it off when wakala names none", async () => {
    stubFetch({
      [`GET ${wakala}/instances`]: {
        body: [
          { id: "h1", name: "Siaya", role: "owner", kind: "farmers' group" },
          { id: "h2", name: "Kisumu", role: "owner", kind: "" },
          { id: "h3", name: "Nairobi", role: "owner", kind: 7 },
        ],
      },
    });

    expect(await listHubs()).toEqual([
      { id: "h1", name: "Siaya", role: "owner", kind: "farmers' group" },
      { id: "h2", name: "Kisumu", role: "owner" },
      { id: "h3", name: "Nairobi", role: "owner" },
    ]);
  });

  it("finds each hub's managers' room among its groups by name, whatever the case", async () => {
    stubFetch({
      [`GET ${wakala}/instances`]: { body: [{ id: "h1", name: "Siaya", role: "owner" }, { id: "h2", name: "Kisumu", role: "owner" }] },
    });
    vi.mocked(callTool).mockImplementation(async (hub: string) =>
      hub === "h1" ? { items: [{ id: "g-farmers", name: "Farmers' room" }, { id: "g-managers", name: "MANAGERS' ROOM" }] } : { items: [{ id: "g-x", name: "Riders" }] },
    );
    expect(await listHubs()).toEqual([
      { id: "h1", name: "Siaya", role: "owner", manager_room_id: "g-managers" },
      { id: "h2", name: "Kisumu", role: "owner" },
    ]);
    expect(callTool).toHaveBeenCalledWith("h1", "actor_list_groups");
  });

  it("reads a bare list of groups as well as an items answer", async () => {
    stubFetch({ [`GET ${wakala}/instances`]: { body: [{ id: "h1", name: "Siaya", role: "owner" }] } });
    vi.mocked(callTool).mockResolvedValue([{ id: "g-managers", name: "Managers' room" }]);
    expect(await listHubs()).toEqual([{ id: "h1", name: "Siaya", role: "owner", manager_room_id: "g-managers" }]);
  });

  it("still lists the hubs when the groups cannot be read", async () => {
    stubFetch({ [`GET ${wakala}/instances`]: { body: [{ id: "h1", name: "Siaya", role: "owner" }] } });
    vi.mocked(callTool).mockRejectedValue(new Error("not signed in"));
    expect(await listHubs()).toEqual([{ id: "h1", name: "Siaya", role: "owner" }]);
  });

  it("never asks the retired studio for anything", async () => {
    const seen = stubFetch({ [`GET ${wakala}/instances`]: { body: [{ id: "h1", name: "Siaya", role: "owner" }] } });
    await listHubs();
    expect(seen.map((s) => s.url)).toEqual([`${wakala}/instances`]);
  });

  it("lists no hubs when wakala answers with something that is not a list", async () => {
    stubFetch({ [`GET ${wakala}/instances`]: { body: { hubs: [] } } });

    expect(await listHubs()).toEqual([]);
  });

  it("lists nothing at all when wakala refuses", async () => {
    stubFetch({ [`GET ${wakala}/instances`]: { status: 401, body: { error: "authentication required" } } });

    expect(await listHubs()).toBeNull();
  });

  it("restores the hubs of a signed-in caller after checking the session", async () => {
    const seen = stubFetch({
      [`GET ${wakala}/auth/session`]: { body: { member_id: "m-1" } },
      [`GET ${wakala}/instances`]: { body: [{ id: "a", name: "Alpha", role: "owner" }] },
    });

    expect(await restoreHubs()).toEqual([{ id: "a", name: "Alpha", role: "owner" }]);
    expect(seen.map((s) => s.url)).toEqual([`${wakala}/auth/session`, `${wakala}/instances`]);
  });

  it("restores nothing and does not ask for hubs when there is no session", async () => {
    const seen = stubFetch({ [`GET ${wakala}/auth/session`]: { status: 401, body: { error: "not signed in" } } });

    expect(await restoreHubs()).toBeNull();
    expect(seen).toHaveLength(1);
  });
});

describe("importing a hub and listing services", () => {
  it("posts the template with the typed name over its own name, cookie allowed", async () => {
    const seen = stubFetch({ [`POST ${wakala}/instances/import`]: { status: 201, body: { instance: { id: "k", name: "Kisumu" } } } });

    const reply = await importHub("Kisumu", { name: "Template name", agency: { name: "Lab" }, roles: [] });

    expect(reply.data.instance?.id).toBe("k");
    expect(seen[0].init.credentials).toBe("include");
    expect(JSON.parse(String(seen[0].init.body))).toEqual({ name: "Kisumu", agency: { name: "Lab" }, roles: [] });
  });

  it("gets the services with the cookie allowed", async () => {
    const seen = stubFetch({ [`GET ${wakala}/services`]: { body: [{ service: "hub-steward", subject: "service-hub-steward" }] } });

    const reply = await listServices();

    expect(serviceNames(reply.data)).toEqual(["hub-steward"]);
    expect(seen[0].init.credentials).toBe("include");
  });

  it("names no service when the answer is not a list of services", () => {
    expect(serviceNames({ error: "no" })).toEqual([]);
    expect(serviceNames([null, { service: 3 }, { service: "x" }])).toEqual(["x"]);
  });
});

describe("the base address", () => {
  it("is the one the runtime config names, not a fixed one", async () => {
    setRuntimeConfig({ wakala: "https://elsewhere.example", mcp: "https://elsewhere.example/mcp" });
    const seen = stubFetch({ "GET https://elsewhere.example/services": { body: [] } });

    await listServices();

    expect(seen[0].url).toBe("https://elsewhere.example/services");
  });

  it("is empty for the same origin when the config names none", async () => {
    setRuntimeConfig({ wakala: "" });
    const seen = stubFetch({ "GET /services": { body: [] } });

    await listServices();

    expect(seen[0].url).toBe("/services");
  });
});

describe("the reason of a refusal", () => {
  it("is the error wakala sent", () => {
    expect(reasonOf({ ok: false, status: 400, data: { error: "name must not be empty" } }, "fallback")).toBe("name must not be empty");
  });

  it("is the fallback when there is no error, a blank one or no reply", () => {
    expect(reasonOf({ ok: false, status: 500, data: {} }, "fallback")).toBe("fallback");
    expect(reasonOf({ ok: false, status: 500, data: { error: "  " } }, "fallback")).toBe("fallback");
    expect(reasonOf({ ok: false, status: 500, data: { error: 5 } }, "fallback")).toBe("fallback");
    expect(reasonOf({ ok: false, status: 500, data: null }, "fallback")).toBe("fallback");
    expect(reasonOf(null, "fallback")).toBe("fallback");
  });
});
