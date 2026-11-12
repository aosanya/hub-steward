import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { forgetRuntimeConfig, parseConfig, setRuntimeConfig } from "./config";
import { McpError, callTool, isReadTool, listTools, onRefused, replyFrom, resetMcp } from "./mcp";
import { keepToken, storedToken } from "./token";

type Answer = { ok?: boolean; status?: number; body?: string };

const answer = ({ ok = true, status = 200, body = "" }: Answer) => ({
  ok,
  status,
  headers: new Headers({ "Mcp-Session-Id": "s1" }),
  text: async () => body,
});

const rpc = (result: unknown) => JSON.stringify({ jsonrpc: "2.0", id: 2, result });

const stub = (onCall: (body: any) => Answer) => {
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (body.method === "initialize") return answer({ body: rpc({}) });
    if (body.method === "notifications/initialized") return answer({ body: "" });
    return answer(onCall(body));
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};

const callsOf = (fetcher: ReturnType<typeof vi.fn>, method: string) =>
  fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body ?? "{}"))).filter((body) => body.method === method);

beforeEach(() => {
  setRuntimeConfig({ mcp: "https://api.example/mcp" });
  forgetOpenAgency();
  resetMcp();
});

afterEach(() => {
  vi.unstubAllGlobals();
  forgetRuntimeConfig();
  resetMcp();
});

describe("what a tool call sends", () => {
  it("adds the open agency as instance_id", async () => {
    openAgency("agency-7");
    const fetcher = stub(() => ({ body: rpc({ structuredContent: { items: [] } }) }));
    await callTool("", "market_create_offer", { title: "Maize" });
    expect(callsOf(fetcher, "tools/call")[0].params).toEqual({
      name: "market_create_offer",
      arguments: { title: "Maize", instance_id: "agency-7" },
    });
  });

  it("keeps an instance_id the caller already named", async () => {
    openAgency("agency-7");
    const fetcher = stub(() => ({ body: rpc({ structuredContent: {} }) }));
    await callTool("", "market_create_offer", { instance_id: "other" });
    expect(callsOf(fetcher, "tools/call")[0].params.arguments.instance_id).toBe("other");
  });

  it("uses the agency named by the caller over the open one", async () => {
    openAgency("agency-7");
    const fetcher = stub(() => ({ body: rpc({ structuredContent: {} }) }));
    await callTool("agency-9", "market_create_offer", {});
    expect(callsOf(fetcher, "tools/call")[0].params.arguments.instance_id).toBe("agency-9");
  });

  it("sends no instance_id for the tool that spans agencies", async () => {
    openAgency("agency-7");
    const fetcher = stub(() => ({ body: rpc({ structuredContent: { items: [] } }) }));
    await callTool("", "agency_list_instances", {});
    expect(callsOf(fetcher, "tools/call")[0].params.arguments).toEqual({});
  });
});

describe("who a tool call is sent as", () => {
  afterEach(() => window.localStorage.clear());

  const headersOf = (fetcher: ReturnType<typeof vi.fn>) =>
    fetcher.mock.calls.map(([, init]) => (init?.headers ?? {}) as Record<string, string>);

  it("carries the kept sign-in link token as a bearer on every request, and the cookie still goes", async () => {
    keepToken({ accessToken: "t1", expiresAt: Date.now() + 60_000, refreshToken: null });
    const fetcher = stub(() => ({ body: rpc({ structuredContent: {} }) }));
    await callTool("", "market_create_offer", {});
    expect(headersOf(fetcher).every((headers) => headers.Authorization === "Bearer t1")).toBe(true);
    expect(fetcher.mock.calls.every(([, init]) => init?.credentials === "include")).toBe(true);
  });

  it("carries no authorization with no token kept", async () => {
    const fetcher = stub(() => ({ body: rpc({ structuredContent: {} }) }));
    await callTool("", "market_create_offer", {});
    expect(headersOf(fetcher).some((headers) => "Authorization" in headers)).toBe(false);
  });
});

describe("a tool call made as the kept token nears its end", () => {
  afterEach(() => window.localStorage.clear());

  const withRefresh = (refreshAnswer: { status: number; body?: unknown }) => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        return { ok: refreshAnswer.status === 200, status: refreshAnswer.status, json: async () => refreshAnswer.body };
      }
      const body = JSON.parse(String(init?.body ?? "{}"));
      return answer({ body: body.method === "tools/call" ? rpc({ structuredContent: { ok: true } }) : rpc({}) });
    });
    vi.stubGlobal("fetch", fetcher);
    return fetcher;
  };

  const refreshes = (fetcher: ReturnType<typeof vi.fn>) => fetcher.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh"));

  const bearersOf = (fetcher: ReturnType<typeof vi.fn>) =>
    fetcher.mock.calls
      .filter(([url]) => String(url) === "https://api.example/mcp")
      .map(([, init]) => (init?.headers as Record<string, string>).Authorization);

  const renewed = { status: 200, body: { access_token: "t2", refresh_token: "r2", expires_in: 3600 } };

  beforeEach(() => setRuntimeConfig({ wakala: "https://api.example", mcp: "https://api.example/mcp" }));

  it("renews first and makes every request of the call with the new token", async () => {
    keepToken({ accessToken: "t1", expiresAt: Date.now() + 30_000, refreshToken: "r1" });
    const fetcher = withRefresh(renewed);
    expect(await callTool("", "market_create_offer", {})).toEqual({ ok: true });
    expect(refreshes(fetcher)).toHaveLength(1);
    expect(JSON.parse(String(refreshes(fetcher)[0][1]?.body))).toEqual({ refresh_token: "r1" });
    expect(bearersOf(fetcher)).toEqual(["Bearer t2", "Bearer t2", "Bearer t2"]);
    expect(storedToken()).toMatchObject({ accessToken: "t2", refreshToken: "r2" });
  });

  it("shares one renewal between calls made at once", async () => {
    keepToken({ accessToken: "t1", expiresAt: Date.now() + 30_000, refreshToken: "r1" });
    const fetcher = withRefresh(renewed);
    await Promise.all([callTool("", "market_create_offer", { a: 1 }), callTool("", "market_create_offer", { a: 2 }), callTool("", "forms_list_forms", {})]);
    expect(refreshes(fetcher)).toHaveLength(1);
    expect(bearersOf(fetcher).every((bearer) => bearer === "Bearer t2")).toBe(true);
  });

  it("does not renew while the token has longer than a minute left", async () => {
    keepToken({ accessToken: "t1", expiresAt: Date.now() + 600_000, refreshToken: "r1" });
    const fetcher = withRefresh(renewed);
    await callTool("", "market_create_offer", {});
    expect(refreshes(fetcher)).toHaveLength(0);
    expect(bearersOf(fetcher).every((bearer) => bearer === "Bearer t1")).toBe(true);
  });

  it("forgets a token whose renewal is refused and sends the call with no bearer", async () => {
    keepToken({ accessToken: "t1", expiresAt: Date.now() + 30_000, refreshToken: "r1" });
    const fetcher = withRefresh({ status: 401 });
    await callTool("", "market_create_offer", {});
    expect(storedToken()).toBeNull();
    expect(bearersOf(fetcher).every((bearer) => bearer === undefined)).toBe(true);
  });

  it("goes on with the old token while it lasts when the renewal cannot get through", async () => {
    keepToken({ accessToken: "t1", expiresAt: Date.now() + 30_000, refreshToken: "r1" });
    const fetcher = withRefresh({ status: 502 });
    await callTool("", "market_create_offer", {});
    expect(storedToken()).toMatchObject({ accessToken: "t1", refreshToken: "r1" });
    expect(bearersOf(fetcher).every((bearer) => bearer === "Bearer t1")).toBe(true);
  });
});

describe("a tool that answers badly", () => {
  it("throws the tool's own text when it reports isError", async () => {
    stub(() => ({ body: rpc({ isError: true, content: [{ text: "not allowed to approve" }] }) }));
    await expect(callTool("", "market_approve_order", {})).rejects.toThrow("market_approve_order: not allowed to approve");
  });

  it("throws with an empty reason when isError carries no content", async () => {
    stub(() => ({ body: rpc({ isError: true }) }));
    await expect(callTool("", "market_approve_order", {})).rejects.toThrow("market_approve_order: ");
  });

  it("throws the JSON-RPC error message", async () => {
    stub(() => ({ body: JSON.stringify({ jsonrpc: "2.0", id: 2, error: { code: -32602, message: "bad params" } }) }));
    await expect(callTool("", "market_list_offers", {})).rejects.toThrow("market_list_offers: bad params");
  });

  it("returns an empty object when the result has no structured content", async () => {
    stub(() => ({ body: rpc({}) }));
    expect(await callTool("", "market_create_offer", {})).toEqual({});
  });

  it("returns an empty object when the reply has no result", async () => {
    stub(() => ({ body: JSON.stringify({ jsonrpc: "2.0", id: 2 }) }));
    expect(await callTool("", "market_create_offer", {})).toEqual({});
  });

  it("reports the status and text of a server failure", async () => {
    stub(() => ({ ok: false, status: 500, body: " boom \n" }));
    await expect(callTool("", "market_create_offer", {})).rejects.toThrow("wakala answered 500: boom");
  });

  it("reports a reply that carries no message", async () => {
    stub(() => ({ body: "event: ping\n" }));
    await expect(callTool("", "market_create_offer", {})).rejects.toThrow("the tool answer carried no message");
  });
});

describe("a refused session", () => {
  it.each([401, 403])("tells every listener and throws not signed in on %i", async (status) => {
    stub(() => ({ ok: false, status }));
    const listener = vi.fn();
    const stop = onRefused(listener);
    const error = await callTool("", "market_create_offer", {}).catch((e) => e);
    stop();
    expect(error).toBeInstanceOf(McpError);
    expect(error.message).toBe("not signed in");
    expect(error.unauthorized).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not tell a listener that has stopped listening", async () => {
    stub(() => ({ ok: false, status: 401 }));
    const listener = vi.fn();
    onRefused(listener)();
    await callTool("", "market_create_offer", {}).catch(() => {});
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not mark a 500 as unauthorized", async () => {
    stub(() => ({ ok: false, status: 500, body: "x" }));
    const listener = vi.fn();
    const stop = onRefused(listener);
    const error = await callTool("", "market_create_offer", {}).catch((e) => e);
    stop();
    expect(error.unauthorized).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it("throws not signed in when the session cannot even open", async () => {
    const fetcher = vi.fn(async () => answer({ ok: false, status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(callTool("", "market_create_offer", {})).rejects.toThrow("not signed in");
  });

  it("opens a new session after the first one failed to open", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (body.method === "initialize") return fetcher.mock.calls.length === 1 ? answer({ ok: false, status: 503, body: "down" }) : answer({ body: rpc({}) });
      return answer({ body: rpc({ structuredContent: { ok: true } }) });
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(callTool("", "market_create_offer", {})).rejects.toThrow("503");
    expect(await callTool("", "market_create_offer", {})).toEqual({ ok: true });
  });
});

describe("a session the server forgot", () => {
  it.each([404, 400])("opens a new session and asks again after %i", async (status) => {
    let first = true;
    const fetcher = stub(() => {
      if (first) {
        first = false;
        return { ok: false, status };
      }
      return { body: rpc({ structuredContent: { items: ["a"] } }) };
    });
    expect(await callTool("", "market_create_offer", {})).toEqual({ items: ["a"] });
    expect(callsOf(fetcher, "initialize")).toHaveLength(2);
  });

  it("gives up when the second answer is a failure too", async () => {
    stub(() => ({ ok: false, status: 404, body: "gone" }));
    await expect(callTool("", "market_create_offer", {})).rejects.toThrow("wakala answered 404: gone");
  });
});

describe("reading the same thing twice", () => {
  it("asks once for the same list with the same arguments in any order", async () => {
    const fetcher = stub(() => ({ body: rpc({ structuredContent: { items: [] } }) }));
    await callTool("", "forms_list_forms", { a: 1, b: { y: 1, x: 2 } });
    await callTool("", "forms_list_forms", { b: { x: 2, y: 1 }, a: 1 });
    expect(callsOf(fetcher, "tools/call")).toHaveLength(1);
  });

  it("asks again for different arguments", async () => {
    const fetcher = stub(() => ({ body: rpc({ structuredContent: { items: [] } }) }));
    await callTool("", "forms_list_forms", { a: 1 });
    await callTool("", "forms_list_forms", { a: 2 });
    expect(callsOf(fetcher, "tools/call")).toHaveLength(2);
  });

  it("forgets a failed read so the next call asks again", async () => {
    let fail = true;
    const fetcher = stub(() => {
      if (fail) {
        fail = false;
        return { ok: false, status: 500, body: "x" };
      }
      return { body: rpc({ structuredContent: { items: [1] } }) };
    });
    await expect(callTool("", "forms_list_forms", {})).rejects.toThrow();
    expect(await callTool("", "forms_list_forms", {})).toEqual({ items: [1] });
    expect(callsOf(fetcher, "tools/call")).toHaveLength(2);
  });

  it("forgets every read once a write is made", async () => {
    const fetcher = stub(() => ({ body: rpc({ structuredContent: { items: [] } }) }));
    await callTool("", "forms_list_forms", {});
    await callTool("", "forms_submit_form", {});
    await callTool("", "forms_list_forms", {});
    expect(callsOf(fetcher, "tools/call")).toHaveLength(3);
  });

  it("forgets every read when the write fails", async () => {
    let writes = 0;
    const fetcher = stub((body) => {
      if (body.params.name === "forms_submit_form") {
        writes++;
        return { body: rpc({ isError: true, content: [{ text: "no" }] }) };
      }
      return { body: rpc({ structuredContent: { items: [] } }) };
    });
    await callTool("", "forms_list_forms", {});
    await callTool("", "forms_submit_form", {}).catch(() => {});
    await callTool("", "forms_list_forms", {});
    expect(writes).toBe(1);
    expect(callsOf(fetcher, "tools/call")).toHaveLength(3);
  });
});

describe("which tools count as reads", () => {
  it.each(["market_list_offers", "forms_get_form", "x_check_y", "x_resolve", "x_trail"])("%s is a read", (tool) => {
    expect(isReadTool(tool)).toBe(true);
  });

  it.each(["market_create_offer", "forms_submit_form", "listing_create", "budget_set"])("%s is a write", (tool) => {
    expect(isReadTool(tool)).toBe(false);
  });
});

describe("replyFrom", () => {
  it("reads a plain JSON body", () => {
    expect(replyFrom(' {"a":1} ')).toEqual({ a: 1 });
  });

  it("reads the data line of an event stream", () => {
    expect(replyFrom('event: message\ndata: {"a":2}\n\n')).toEqual({ a: 2 });
  });

  it("throws on a stream with no data line", () => {
    expect(() => replyFrom("event: ping\n\n")).toThrow("the tool answer carried no message");
  });

  it("throws on a data line that is not JSON", () => {
    expect(() => replyFrom("data: not json")).toThrow();
  });
});

describe("listing tools", () => {
  it("follows the cursor to the last page", async () => {
    const fetcher = stub((body) =>
      body.params.cursor
        ? { body: rpc({ tools: [{ name: "b", description: "Second", inputSchema: { type: "object", properties: {} } }] }) }
        : { body: rpc({ tools: [{ name: "a", description: "First" }], nextCursor: "c2" }) },
    );
    const tools = await listTools();
    expect(tools.map((tool) => tool.name)).toEqual(["a", "b"]);
    expect(callsOf(fetcher, "tools/list")).toHaveLength(2);
  });

  it("fills a missing description and schema and drops a nameless tool", async () => {
    stub(() => ({ body: rpc({ tools: [{ name: "a" }, { description: "no name" }, null] }) }));
    expect(await listTools()).toEqual([{ name: "a", description: "", inputSchema: { type: "object" } }]);
  });

  it("treats a reply with no tools as none", async () => {
    stub(() => ({ body: rpc({}) }));
    expect(await listTools()).toEqual([]);
  });

  it("asks once and shares the answer", async () => {
    const fetcher = stub(() => ({ body: rpc({ tools: [{ name: "a" }] }) }));
    await Promise.all([listTools(), listTools()]);
    expect(callsOf(fetcher, "tools/list")).toHaveLength(1);
  });

  it("asks again after a failed listing", async () => {
    let fail = true;
    stub(() => {
      if (fail) {
        fail = false;
        return { ok: false, status: 500, body: "x" };
      }
      return { body: rpc({ tools: [{ name: "a" }] }) };
    });
    await expect(listTools()).rejects.toThrow();
    expect((await listTools()).map((tool) => tool.name)).toEqual(["a"]);
  });
});

describe("closing the session", () => {
  it("sends a DELETE with the session id once and not twice", async () => {
    const fetcher = stub(() => ({ body: rpc({ structuredContent: {} }) }));
    await callTool("", "market_create_offer", {});
    resetMcp();
    resetMcp();
    const deletes = fetcher.mock.calls.filter(([, init]) => init?.method === "DELETE");
    expect(deletes).toHaveLength(1);
    expect(deletes[0][1]?.headers).toEqual({ "Mcp-Session-Id": "s1" });
  });

  it("sends nothing when no session was opened", () => {
    const fetcher = stub(() => ({}));
    resetMcp();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("the runtime config", () => {
  it("defaults the mcp endpoint to the wakala origin plus /mcp", () => {
    expect(parseConfig({ wakala: "https://w.example///" })).toEqual({ wakala: "https://w.example", mcp: "https://w.example/mcp" });
  });

  it("prefers an explicit mcp endpoint", () => {
    expect(parseConfig({ wakala: "https://w", mcp: " https://m/mcp/ " })).toEqual({ wakala: "https://w", mcp: "https://m/mcp" });
  });

  it.each([null, undefined, "text", 4, []])("falls back to same origin for %s", (raw) => {
    expect(parseConfig(raw)).toEqual({ wakala: "", mcp: "/mcp" });
  });

  it("keeps the agency an app is limited to", () => {
    expect(parseConfig({ wakala: "", agency: " Zöldhalom " })).toEqual({ wakala: "", mcp: "/mcp", agency: "Zöldhalom" });
  });

  it("holds no field beyond the wakala origin, the mcp endpoint and the limiting agency, whatever the file names", () => {
    expect(parseConfig({ wakala: "https://w", template: "farmers" })).toEqual({ wakala: "https://w", mcp: "https://w/mcp" });
  });

  it("ignores values that are not strings", () => {
    expect(parseConfig({ wakala: 3, mcp: {} })).toEqual({ wakala: "", mcp: "/mcp" });
  });
});
