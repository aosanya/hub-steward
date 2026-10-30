import type { Settings } from "./env";

type Json = Record<string, unknown>;

const jsonHeaders = { "Content-Type": "application/json" };
const mcpHeaders = { ...jsonHeaders, Accept: "application/json, text/event-stream" };

export class Mcp {
  private cookie = "";
  private session = "";
  private count = 1;

  constructor(private readonly settings: Settings, private readonly instanceId: string) {}

  async open(): Promise<this> {
    await this.send({ jsonrpc: "2.0", id: this.count++, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "e2e", version: "1" } } });
    await this.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    return this;
  }

  async signIn(): Promise<this> {
    const reply = await fetch(this.settings.apiURL + "/auth/signin", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email: this.settings.email, password: this.settings.password }) });
    if (!reply.ok) throw new Error(`sign-in answered ${reply.status}`);
    this.cookie = (reply.headers.getSetCookie?.() ?? []).map((line) => line.split(";")[0]).join("; ");
    return this;
  }

  private async send(payload: Json): Promise<Json | null> {
    const headers: Record<string, string> = { ...mcpHeaders, Cookie: this.cookie };
    if (this.session) headers["Mcp-Session-Id"] = this.session;
    const reply = await fetch(this.settings.apiURL + "/mcp", { method: "POST", headers, body: JSON.stringify(payload) });
    this.session = reply.headers.get("Mcp-Session-Id") ?? this.session;
    if (!reply.ok) throw new Error(`/mcp answered ${reply.status}`);
    const text = await reply.text();
    const data = text.split("\n").filter((line) => line.startsWith("data:")).pop();
    const body = data ? data.slice(5).trim() : text.trim();
    return body ? (JSON.parse(body) as Json) : null;
  }

  async tool<T = Json>(name: string, args: Json = {}): Promise<T> {
    const answer = await this.send({ jsonrpc: "2.0", id: this.count++, method: "tools/call", params: { name, arguments: { instance_id: this.instanceId, ...args } } });
    const error = answer?.error as { message?: string } | undefined;
    if (error) throw new Error(`${name}: ${error.message ?? "refused"}`);
    const result = (answer?.result ?? {}) as { isError?: boolean; content?: { text: string }[]; structuredContent?: T };
    if (result.isError) throw new Error(`${name}: ${(result.content?.[0]?.text ?? "refused").slice(0, 300)}`);
    return (result.structuredContent ?? {}) as T;
  }

  async items(name: string, args: Json = {}): Promise<Json[]> {
    return ((await this.tool<{ items?: Json[] }>(name, args)).items ?? []) as Json[];
  }
}

export const hubIdOf = async (settings: Settings): Promise<string> => {
  const reply = await fetch(settings.apiURL + "/auth/signin", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email: settings.email, password: settings.password }) });
  if (!reply.ok) throw new Error(`sign-in answered ${reply.status}`);
  const cookie = (reply.headers.getSetCookie?.() ?? []).map((line) => line.split(";")[0]).join("; ");
  const list = await fetch(settings.apiURL + "/instances", { headers: { Cookie: cookie } });
  const body = (await list.json()) as { items?: { id: string; name: string }[] } | { id: string; name: string }[];
  const items = Array.isArray(body) ? body : body.items ?? [];
  const hub = items.find((item) => item.name === settings.hubName);
  if (!hub) throw new Error(`no hub named ${settings.hubName}`);
  return hub.id;
};
