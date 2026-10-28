import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setRuntimeConfig } from "./config";
import { McpError, callTool, closeMcp, isReadTool, listTools, replyFrom, resetMcp } from "./mcp";

type Seen = { url: string; init: RequestInit; body: any };

type Answer = { status?: number; headers?: Record<string, string>; text?: string };

const result = (structuredContent: unknown) => JSON.stringify({ jsonrpc: "2.0", id: 1, result: { structuredContent } });

function stubWakala(answerFor: (body: any, seen: Seen[]) => Answer) {
  const seen: Seen[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      seen.push({ url, init, body });
      const answer = answerFor(body, seen);
      const status = answer.status ?? 200;
      return { ok: status < 400, status, headers: new Headers(answer.headers ?? {}), text: async () => answer.text ?? "" };
    }),
  );
  return seen;
}

const healthy = (tools: Record<string, (args: any) => unknown> = {}) =>
  stubWakala((body) => {
    if (body.method === "initialize") return { headers: { "Mcp-Session-Id": "s-1" }, text: JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }) };
    if (body.method === "notifications/initialized") return { status: 202 };
    return { text: result(tools[body.params.name]?.(body.params.arguments) ?? {}) };
  });

beforeEach(() => {
  resetMcp();
  setRuntimeConfig({ wakala: "https://wakala.test", mcp: "https://wakala.test/mcp" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("opening the tool session", () => {
  it("initializes at the mcp address the runtime config names, with the cookie allowed", async () => {
    const seen = healthy();

    await callTool("hub-1", "agency_list_roles");

    expect(seen[0].url).toBe("https://wakala.test/mcp");
    expect(seen[0].body.method).toBe("initialize");
    expect(seen[0].init.credentials).toBe("include");
  });

  it("sends every message to that address, not to a fixed one", async () => {
    setRuntimeConfig({ wakala: "https://elsewhere.example", mcp: "https://elsewhere.example/tools" });
    const seen = healthy();

    await callTool("hub-1", "agency_list_roles");

    expect(seen.map((s) => s.url)).toEqual(Array(3).fill("https://elsewhere.example/tools"));
  });

  it("uses the same-origin pass-through when the config names it", async () => {
    setRuntimeConfig({ wakala: "", mcp: "/mcp" });
    const seen = healthy();

    await callTool("hub-1", "agency_list_roles");

    expect(seen.every((s) => s.url === "/mcp")).toBe(true);
  });

  it("reads the session id wakala sends back and sends it with the next messages", async () => {
    const seen = healthy();

    await callTool("hub-1", "agency_list_roles");

    expect(seen[0].init.headers).not.toHaveProperty("Mcp-Session-Id");
    expect(seen[1].body.method).toBe("notifications/initialized");
    expect(seen[1].init.headers).toMatchObject({ "Mcp-Session-Id": "s-1" });
    expect(seen[2].init.headers).toMatchObject({ "Mcp-Session-Id": "s-1" });
  });

  it("asks for JSON or event-stream answers", async () => {
    const seen = healthy();

    await callTool("hub-1", "agency_list_roles");

    expect(seen[2].init.headers).toMatchObject({ "Content-Type": "application/json", Accept: "application/json, text/event-stream" });
  });

  it("opens one session for many calls", async () => {
    const seen = healthy();

    await callTool("hub-1", "agency_list_roles");
    await callTool("hub-1", "agency_list_drafts");
    await callTool("hub-2", "agency_list_roles");

    expect(seen.filter((s) => s.body.method === "initialize")).toHaveLength(1);
  });

  it("opens a new session after it is reset, as when somebody else signs in", async () => {
    const seen = healthy();
    await callTool("hub-1", "agency_list_roles");

    resetMcp();
    await callTool("hub-1", "agency_list_roles");

    expect(seen.filter((s) => s.body.method === "initialize")).toHaveLength(2);
  });

  it("says nobody is signed in when wakala refuses the session", async () => {
    stubWakala(() => ({ status: 401, text: "authentication required" }));

    await expect(callTool("hub-1", "agency_list_roles")).rejects.toMatchObject({ message: "not signed in", unauthorized: true });
  });

  it("tries to open a session again on the next call after one failed", async () => {
    let up = false;
    const seen = stubWakala((body) => {
      if (!up) return { status: 503, text: "starting" };
      if (body.method === "initialize") return { headers: { "Mcp-Session-Id": "s-2" }, text: "{}" };
      if (body.method === "notifications/initialized") return { status: 202 };
      return { text: result({}) };
    });
    await expect(callTool("hub-1", "agency_list_roles")).rejects.toThrow("wakala answered 503: starting");

    up = true;
    await callTool("hub-1", "agency_list_roles");

    expect(seen.filter((s) => s.body.method === "initialize")).toHaveLength(2);
  });
});

describe("calling a tool", () => {
  it("sends the tool name, the arguments and the hub as instance_id", async () => {
    const seen = healthy();

    await callTool("hub-1", "agency_list_roles", { draft_id: "d-1" });

    const call = seen[2].body;
    expect(call).toMatchObject({ jsonrpc: "2.0", method: "tools/call", params: { name: "agency_list_roles", arguments: { draft_id: "d-1", instance_id: "hub-1" } } });
  });

  it("keeps an instance_id the caller gave", async () => {
    const seen = healthy();

    await callTool("hub-1", "agency_list_roles", { instance_id: "hub-9" });

    expect(seen[2].body.params.arguments.instance_id).toBe("hub-9");
  });

  it("sends no instance_id when the call has no hub", async () => {
    const seen = healthy();

    await callTool("", "agency_list_instances");

    expect(seen[2].body.params.arguments).toEqual({});
  });

  it("returns the structured content of the answer", async () => {
    healthy({ agency_list_roles: () => ({ items: [{ id: "r-1" }] }) });

    expect(await callTool("hub-1", "agency_list_roles")).toEqual({ items: [{ id: "r-1" }] });
  });

  it("reads an answer that comes as an event stream", async () => {
    stubWakala((body) => {
      if (body.method === "initialize") return { headers: { "Mcp-Session-Id": "s-1" }, text: "{}" };
      if (body.method === "notifications/initialized") return { status: 202 };
      return { text: `event: message\ndata: ${result({ items: [] })}\n\n` };
    });

    expect(await callTool("hub-1", "agency_list_roles")).toEqual({ items: [] });
  });

  it("names the tool when it answers with an error", async () => {
    stubWakala((body) => {
      if (body.method === "initialize") return { headers: { "Mcp-Session-Id": "s-1" }, text: "{}" };
      if (body.method === "notifications/initialized") return { status: 202 };
      return { text: JSON.stringify({ jsonrpc: "2.0", id: 2, error: { code: -32602, message: "unknown tool" } }) };
    });

    await expect(callTool("hub-1", "nope")).rejects.toThrow("nope: unknown tool");
  });

  it("names the tool and the reason when the tool reports a failure", async () => {
    stubWakala((body) => {
      if (body.method === "initialize") return { headers: { "Mcp-Session-Id": "s-1" }, text: "{}" };
      if (body.method === "notifications/initialized") return { status: 202 };
      return { text: JSON.stringify({ jsonrpc: "2.0", id: 2, result: { isError: true, content: [{ type: "text", text: "only the owner may do that" }] } }) };
    });

    await expect(callTool("hub-1", "agency_grant_service")).rejects.toThrow("agency_grant_service: only the owner may do that");
  });

  it("opens a new session and asks again once when wakala has forgotten the session", async () => {
    let forgotten = true;
    const seen = stubWakala((body) => {
      if (body.method === "initialize") return { headers: { "Mcp-Session-Id": "s-new" }, text: "{}" };
      if (body.method === "notifications/initialized") return { status: 202 };
      if (forgotten) {
        forgotten = false;
        return { status: 404, text: "session not found" };
      }
      return { text: result({ ok: true }) };
    });

    expect(await callTool("hub-1", "agency_list_roles")).toEqual({ ok: true });
    expect(seen.filter((s) => s.body.method === "initialize")).toHaveLength(2);
  });

  it("says nobody is signed in when a call is refused", async () => {
    stubWakala((body) => {
      if (body.method === "initialize") return { headers: { "Mcp-Session-Id": "s-1" }, text: "{}" };
      if (body.method === "notifications/initialized") return { status: 202 };
      return { status: 403, text: "forbidden" };
    });

    await expect(callTool("hub-1", "agency_list_roles")).rejects.toBeInstanceOf(McpError);
    await expect(callTool("hub-1", "agency_list_roles")).rejects.toMatchObject({ unauthorized: true });
  });
});

const toolsAnswer = (tools: unknown[], nextCursor?: string) =>
  JSON.stringify({ jsonrpc: "2.0", id: 1, result: nextCursor ? { tools, nextCursor } : { tools } });

function stubToolList(pages: Record<string, { tools: unknown[]; next?: string }>) {
  return stubWakala((body) => {
    if (body.method === "initialize") return { headers: { "Mcp-Session-Id": "s-1" }, text: "{}" };
    if (body.method === "notifications/initialized") return { status: 202 };
    const page = pages[body.params?.cursor ?? ""];
    return { text: toolsAnswer(page.tools, page.next) };
  });
}

describe("listing the tools", () => {
  it("asks the open session for its tools and keeps each one's name, description and input schema", async () => {
    const schema = { type: "object", properties: { instance_id: { type: "string" } } };
    const seen = stubToolList({ "": { tools: [{ name: "agency_list_roles", description: "Roles", inputSchema: schema }, { name: "bare" }] } });

    expect(await listTools()).toEqual([
      { name: "agency_list_roles", description: "Roles", inputSchema: schema },
      { name: "bare", description: "", inputSchema: { type: "object" } },
    ]);
    expect(seen.map((s) => s.body.method)).toEqual(["initialize", "notifications/initialized", "tools/list"]);
    expect(seen[2].body.params).toEqual({});
    expect(seen[2].init.credentials).toBe("include");
  });

  it("asks once for many asks", async () => {
    const seen = stubToolList({ "": { tools: [{ name: "a_list" }] } });

    await listTools();
    await listTools();

    expect(seen.filter((s) => s.body.method === "tools/list")).toHaveLength(1);
  });

  it("asks again after the session is reset, as when somebody else signs in", async () => {
    const seen = stubToolList({ "": { tools: [{ name: "a_list" }] } });

    await listTools();
    resetMcp();
    await listTools();

    expect(seen.filter((s) => s.body.method === "tools/list")).toHaveLength(2);
  });

  it("follows the cursor until the list ends", async () => {
    const seen = stubToolList({
      "": { tools: [{ name: "one_list" }], next: "c-2" },
      "c-2": { tools: [{ name: "two_list" }], next: "c-3" },
      "c-3": { tools: [{ name: "three_list" }] },
    });

    expect((await listTools()).map((tool) => tool.name)).toEqual(["one_list", "two_list", "three_list"]);
    expect(seen.filter((s) => s.body.method === "tools/list").map((s) => s.body.params)).toEqual([{}, { cursor: "c-2" }, { cursor: "c-3" }]);
  });

  it("leaves out an entry with no name", async () => {
    stubToolList({ "": { tools: [{ description: "nameless" }, { name: "a_list" }] } });

    expect((await listTools()).map((tool) => tool.name)).toEqual(["a_list"]);
  });

  it("opens a new session and asks again once when wakala has forgotten the session", async () => {
    let forgotten = true;
    const seen = stubWakala((body) => {
      if (body.method === "initialize") return { headers: { "Mcp-Session-Id": "s-new" }, text: "{}" };
      if (body.method === "notifications/initialized") return { status: 202 };
      if (forgotten) {
        forgotten = false;
        return { status: 404, text: "session not found" };
      }
      return { text: toolsAnswer([{ name: "a_list" }]) };
    });

    expect((await listTools()).map((tool) => tool.name)).toEqual(["a_list"]);
    expect(seen.filter((s) => s.body.method === "initialize")).toHaveLength(2);
  });

  it("says nobody is signed in when the list is refused, and asks again next time", async () => {
    let refuse = true;
    stubWakala((body) => {
      if (body.method === "initialize") return { headers: { "Mcp-Session-Id": "s-1" }, text: "{}" };
      if (body.method === "notifications/initialized") return { status: 202 };
      return refuse ? { status: 401, text: "no" } : { text: toolsAnswer([{ name: "a_list" }]) };
    });

    await expect(listTools()).rejects.toMatchObject({ unauthorized: true });
    refuse = false;
    expect((await listTools()).map((tool) => tool.name)).toEqual(["a_list"]);
  });

  it("names the request when wakala answers it with an error", async () => {
    stubWakala((body) => {
      if (body.method === "initialize") return { headers: { "Mcp-Session-Id": "s-1" }, text: "{}" };
      if (body.method === "notifications/initialized") return { status: 202 };
      return { text: JSON.stringify({ jsonrpc: "2.0", id: 1, error: { message: "boom" } }) };
    });

    await expect(listTools()).rejects.toThrow("tools/list: boom");
  });
});

describe("telling a read from a write by the tool's name", () => {
  it("reads list, get, check and resolve, as a whole word of the name", () => {
    for (const name of ["agency_list_roles", "ai_get_account", "ai_check_limits", "ai_resolve_role", "list_things", "get"]) {
      expect(isReadTool(name), name).toBe(true);
    }
  });

  it("does not read what writes, even when the word hides inside another", () => {
    for (const name of ["ai_chat_account", "agency_propose_write", "actor_create_group", "ai_set_limits", "gettysburg_update", "checkout_start"]) {
      expect(isReadTool(name), name).toBe(false);
    }
  });
});

describe("reading a reply", () => {
  it("reads a plain JSON message", () => {
    expect(replyFrom(' {"a":1} ')).toEqual({ a: 1 });
  });

  it("reads the first data line of an event stream", () => {
    expect(replyFrom('event: message\ndata: {"a":2}\n\n')).toEqual({ a: 2 });
  });

  it("says so when the answer carries no message", () => {
    expect(() => replyFrom("event: ping\n\n")).toThrow("the tool answer carried no message");
  });
});

describe("closing the tool session", () => {
  it("deletes the open session on the endpoint with the cookie allowed, so the caller's cap is not used up", async () => {
    const seen = healthy();
    await callTool("h1", "agency_list_roles");
    const fetchMock = vi.mocked(fetch);
    closeMcp();
    const last = fetchMock.mock.calls.at(-1)!;
    expect(last[1]).toMatchObject({ method: "DELETE", credentials: "include", keepalive: true, headers: { "Mcp-Session-Id": "s-1" } });
    expect(seen.length).toBeGreaterThan(0);
  });

  it("sends nothing when no session was ever opened", () => {
    resetMcp();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    closeMcp();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts a new session after the old one was closed", async () => {
    const seen = healthy();
    await callTool("h1", "agency_list_roles");
    closeMcp();
    await callTool("h1", "agency_list_roles");
    expect(seen.filter((s) => s.body.method === "initialize")).toHaveLength(2);
  });
});

describe("reading the same thing twice", () => {
  const tools = () => healthy({ agency_list_goals: () => ({ items: [{ id: "g1" }] }), agency_create_goal: () => ({ id: "g2" }) });
  const asked = (seen: Seen[], tool: string) => seen.filter((s) => s.body.method === "tools/call" && s.body.params.name === tool).length;

  beforeEach(() => {
    resetMcp();
    setRuntimeConfig({ wakala: "https://wakala.test", mcp: "https://wakala.test/mcp" });
  });

  it("sends one request when the same read is asked for twice at once", async () => {
    const seen = tools();
    const both = await Promise.all([callTool("h1", "agency_list_goals"), callTool("h1", "agency_list_goals")]);
    expect(both[0]).toEqual(both[1]);
    expect(asked(seen, "agency_list_goals")).toBe(1);
  });

  it("answers the same read again from memory within a minute", async () => {
    const seen = tools();
    await callTool("h1", "agency_list_goals");
    await callTool("h1", "agency_list_goals");
    expect(asked(seen, "agency_list_goals")).toBe(1);
  });

  it("asks again every time for a test run and a scenario's runs, because a running one changes under the page", async () => {
    const seen = healthy({ agency_get_test_run: () => ({ id: "r1", result: "running" }), agency_list_test_runs: () => ({ items: [] }) });
    await callTool("h1", "agency_get_test_run", { test_run_id: "r1" });
    await callTool("h1", "agency_get_test_run", { test_run_id: "r1" });
    await callTool("h1", "agency_list_test_runs", { scenario_id: "s1" });
    await callTool("h1", "agency_list_test_runs", { scenario_id: "s1" });
    expect(asked(seen, "agency_get_test_run")).toBe(2);
    expect(asked(seen, "agency_list_test_runs")).toBe(2);
  });

  it("asks again every time for a review, because the reviewers finish under the page", async () => {
    const seen = healthy({ agency_get_review: () => ({ review: null }), agency_list_reviews: () => ({ items: [] }) });
    await callTool("h1", "agency_get_review", { draft_id: "d1" });
    await callTool("h1", "agency_get_review", { draft_id: "d1" });
    await callTool("h1", "agency_list_reviews", { draft_id: "d1" });
    await callTool("h1", "agency_list_reviews", { draft_id: "d1" });
    expect(asked(seen, "agency_get_review")).toBe(2);
    expect(asked(seen, "agency_list_reviews")).toBe(2);
  });

  it("asks again after a minute", async () => {
    const seen = tools();
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_000);
    await callTool("h1", "agency_list_goals");
    now.mockReturnValue(1_000 + 60_001);
    await callTool("h1", "agency_list_goals");
    now.mockRestore();
    expect(asked(seen, "agency_list_goals")).toBe(2);
  });

  it("keeps a chat or approvals read for only ten seconds, because other people change them", async () => {
    const seen = healthy({ comm_chat_message_list: () => ({ items: [] }), agency_list_approvals: () => ({ items: [] }) });
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_000);
    await callTool("h1", "comm_chat_message_list");
    await callTool("h1", "agency_list_approvals");
    now.mockReturnValue(1_000 + 10_001);
    await callTool("h1", "comm_chat_message_list");
    await callTool("h1", "agency_list_approvals");
    now.mockRestore();
    expect(asked(seen, "comm_chat_message_list")).toBe(2);
    expect(asked(seen, "agency_list_approvals")).toBe(2);
  });

  it("treats a different hub or a different argument as a different read", async () => {
    const seen = tools();
    await callTool("h1", "agency_list_goals");
    await callTool("h2", "agency_list_goals");
    await callTool("h1", "agency_list_goals", { draft_id: "d1" });
    await callTool("h1", "agency_list_goals", { draft_id: "d1" });
    expect(asked(seen, "agency_list_goals")).toBe(3);
  });

  it("does not care in which order the arguments were written", async () => {
    const seen = tools();
    await callTool("h1", "agency_list_goals", { draft_id: "d1", state: "open" });
    await callTool("h1", "agency_list_goals", { state: "open", draft_id: "d1" });
    expect(asked(seen, "agency_list_goals")).toBe(1);
  });

  it("forgets every read when something is written, so the next read sees the change", async () => {
    const seen = tools();
    await callTool("h1", "agency_list_goals");
    await callTool("h1", "agency_create_goal", { title: "Feed the town" });
    await callTool("h1", "agency_list_goals");
    expect(asked(seen, "agency_list_goals")).toBe(2);
  });

  it("never keeps an answer to a write", async () => {
    const seen = tools();
    await callTool("h1", "agency_create_goal", { title: "A" });
    await callTool("h1", "agency_create_goal", { title: "A" });
    expect(asked(seen, "agency_create_goal")).toBe(2);
  });

  it("forgets every read when the session is reset by signing in or out", async () => {
    const seen = tools();
    await callTool("h1", "agency_list_goals");
    resetMcp();
    await callTool("h1", "agency_list_goals");
    expect(asked(seen, "agency_list_goals")).toBe(2);
  });

  it("does not keep a read that failed, so the next ask tries again", async () => {
    let first = true;
    const seen = stubWakala((body) => {
      if (body.method === "initialize") return { headers: { "Mcp-Session-Id": "s-1" }, text: JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }) };
      if (body.method === "notifications/initialized") return { status: 202 };
      if (first) {
        first = false;
        return { text: JSON.stringify({ jsonrpc: "2.0", id: 2, error: { code: -1, message: "boom" } }) };
      }
      return { text: result({ items: [] }) };
    });
    await expect(callTool("h1", "agency_list_goals")).rejects.toThrow("boom");
    await expect(callTool("h1", "agency_list_goals")).resolves.toEqual({ items: [] });
    expect(asked(seen, "agency_list_goals")).toBe(2);
  });
});
