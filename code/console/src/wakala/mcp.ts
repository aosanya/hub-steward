import { runtimeConfig } from "./config";

export class McpError extends Error {
  constructor(
    message: string,
    readonly unauthorized = false,
  ) {
    super(message);
  }
}

let session: Promise<string> | null = null;
let nextId = 0;

let openSessionId = "";
let openEndpoint = "";
let toolList: Promise<ToolInfo[]> | null = null;

const forgetMcp = () => {
  openSessionId = "";
  openEndpoint = "";
  session = null;
  toolList = null;
  reads.clear();
};

export const closeMcp = () => {
  const id = openSessionId;
  const endpoint = openEndpoint;
  forgetMcp();
  if (!id || !endpoint) return;
  fetch(endpoint, { method: "DELETE", credentials: "include", keepalive: true, headers: { "Mcp-Session-Id": id } }).catch(() => {});
};

export const resetMcp = () => {
  closeMcp();
};

const post = async (sessionId: string, body: unknown, signal?: AbortSignal) => {
  const { mcp } = await runtimeConfig();
  return fetch(mcp, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
};

const signedOutListeners = new Set<() => void>();

export const onSignedOut = (listener: () => void) => {
  signedOutListeners.add(listener);
  return () => {
    signedOutListeners.delete(listener);
  };
};

const failed = async (res: Response) => {
  const unauthorized = res.status === 401 || res.status === 403;
  if (res.status === 401) signedOutListeners.forEach((listener) => listener());
  return new McpError(unauthorized ? "not signed in" : `wakala answered ${res.status}: ${(await res.text()).trim()}`, unauthorized);
};

export const replyFrom = (text: string): any => {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  for (const line of text.split("\n")) {
    if (line.startsWith("data:")) return JSON.parse(line.slice(5).trim());
  }
  throw new McpError("the tool answer carried no message");
};

const open = async (): Promise<string> => {
  const res = await post("", {
    jsonrpc: "2.0",
    id: ++nextId,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "hubsteward-console", version: "1" } },
  });
  if (!res.ok) throw await failed(res);
  const sessionId = res.headers.get("Mcp-Session-Id") ?? "";
  openSessionId = sessionId;
  openEndpoint = (await runtimeConfig()).mcp;
  await post(sessionId, { jsonrpc: "2.0", method: "notifications/initialized" });
  return sessionId;
};

const sessionId = () => (session ??= open().catch((e) => {
  session = null;
  throw e;
}));

const request = async (method: string, params: Record<string, unknown>, signal?: AbortSignal) =>
  post(await sessionId(), { jsonrpc: "2.0", id: ++nextId, method, params }, signal);

type Held = { at: number; promise: Promise<unknown> };

const reads = new Map<string, Held>();

const readTool = /(^|_)(list|get|read|check|resolve|breakdown)(_|$)/;

export const isReadTool = (tool: string) => readTool.test(tool);

const volatileRead = /(^|_)(chat|approvals|usage|issues|check|counts|under)(_|$)|^comm_/;

const liveRead = /(^|_)(test_runs?|reviews?)$/;

const reuseFor = (tool: string) => (volatileRead.test(tool) ? 10_000 : 60_000);

const sorted = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(sorted)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, sorted((value as Record<string, unknown>)[k])]))
      : value;

async function exchange(name: string, method: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<any> {
  let res = await request(method, params, signal);
  if (res.status === 404 || res.status === 400) {
    forgetMcp();
    res = await request(method, params, signal);
  }
  if (!res.ok) throw await failed(res);
  const reply = replyFrom(await res.text());
  if (reply.error) throw new McpError(`${name}: ${reply.error.message}`);
  return reply.result ?? {};
}

async function send<T>(tool: string, arguments_: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const result = await exchange(tool, "tools/call", { name: tool, arguments: arguments_ }, signal);
  if (result.isError) throw new McpError(`${tool}: ${result.content?.[0]?.text ?? ""}`);
  return (result.structuredContent ?? {}) as T;
}

export type ToolInfo = { name: string; description: string; inputSchema: Record<string, unknown> };

const toolInfoOf = (raw: any): ToolInfo => ({
  name: String(raw?.name ?? ""),
  description: typeof raw?.description === "string" ? raw.description : "",
  inputSchema: raw?.inputSchema && typeof raw.inputSchema === "object" ? raw.inputSchema : { type: "object" },
});

async function readToolList(): Promise<ToolInfo[]> {
  const found: ToolInfo[] = [];
  let cursor: string | undefined;
  do {
    const page = await exchange("tools/list", "tools/list", cursor ? { cursor } : {});
    found.push(...(Array.isArray(page.tools) ? page.tools : []).map(toolInfoOf).filter((tool: ToolInfo) => tool.name !== ""));
    cursor = typeof page.nextCursor === "string" && page.nextCursor !== "" ? page.nextCursor : undefined;
  } while (cursor);
  return found;
}

export function listTools(): Promise<ToolInfo[]> {
  toolList ??= readToolList().catch((e) => {
    toolList = null;
    throw e;
  });
  return toolList;
}

export function callTool<T = any>(hubId: string, tool: string, args: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  const arguments_ = { ...args };
  if (hubId && arguments_.instance_id === undefined) arguments_.instance_id = hubId;
  if (signal) return send<T>(tool, arguments_, signal);
  if (!readTool.test(tool)) {
    reads.clear();
    return send<T>(tool, arguments_).finally(() => reads.clear());
  }
  if (liveRead.test(tool)) return send<T>(tool, arguments_);
  const key = tool + "|" + JSON.stringify(sorted(arguments_));
  const held = reads.get(key);
  if (held && Date.now() - held.at < reuseFor(tool)) return held.promise as Promise<T>;
  const promise = send<T>(tool, arguments_).catch((e) => {
    reads.delete(key);
    throw e;
  });
  reads.set(key, { at: Date.now(), promise });
  return promise;
}
