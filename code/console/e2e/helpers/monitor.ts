import { readFileSync, writeFileSync } from "node:fs";
import type { Page, Request } from "@playwright/test";

export type Call = { stage: string; method: string; path: string; tool: string; status: number; ms: number };

export type ServerLine = { n: number; level: string; msg: string; method?: string; path?: string; status?: number; outcome?: string; ms?: number; run?: string; tokens_in?: number; tokens_out?: number; raw: string };

export type Finding = { what: string; where: string; evidence: string; severity: "high" | "medium" | "low" };

const backendPrefixes = ["/mcp", "/auth", "/instances", "/services"];

const toolOf = (request: Request): string => {
  if (request.method() !== "POST" || !request.url().includes("/mcp")) return "";
  try {
    const body = JSON.parse(request.postData() ?? "{}") as { method?: string; params?: { name?: string } };
    return body.method === "tools/call" ? String(body.params?.name ?? "") : String(body.method ?? "");
  } catch {
    return "";
  }
};

export class Recorder {
  readonly calls: Call[] = [];
  readonly failed: string[] = [];
  private readonly started = new Map<Request, number>();
  stage = "start";

  attach(page: Page): void {
    page.on("request", (request) => {
      if (this.isBackend(request.url())) this.started.set(request, Date.now());
    });
    page.on("response", (response) => {
      const request = response.request();
      const at = this.started.get(request);
      if (at === undefined) return;
      this.started.delete(request);
      this.calls.push({ stage: this.stage, method: request.method(), path: new URL(request.url()).pathname, tool: toolOf(request), status: response.status(), ms: Date.now() - at });
    });
    page.on("requestfailed", (request) => {
      if (!this.started.delete(request)) return;
      this.failed.push(`${request.method()} ${new URL(request.url()).pathname} ${request.failure()?.errorText ?? ""}`);
    });
  }

  private isBackend(url: string): boolean {
    const path = new URL(url).pathname;
    return backendPrefixes.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
  }

  get unanswered(): number {
    return this.started.size;
  }

  in(stage: string): Call[] {
    return this.calls.filter((call) => call.stage === stage);
  }

  count(stage: string, tool: string): number {
    return this.in(stage).filter((call) => call.tool === tool).length;
  }
}

export class ServerLog {
  constructor(private readonly path: string) {}

  mark(): number {
    return this.lines().length;
  }

  since(mark: number): ServerLine[] {
    return this.parsed().filter((line) => line.n > mark);
  }

  all(): ServerLine[] {
    return this.parsed();
  }

  private lines(): string[] {
    const text = readFileSync(this.path, "utf8");
    return text === "" ? [] : text.replace(/\n$/, "").split("\n");
  }

  private parsed(): ServerLine[] {
    return this.lines().map((raw, index) => {
      try {
        const fields = JSON.parse(raw) as Record<string, unknown>;
        return { n: index + 1, level: String(fields.level ?? ""), msg: String(fields.msg ?? ""), method: fields.method as string | undefined, path: fields.path as string | undefined, status: typeof fields.status === "number" ? fields.status : undefined, outcome: typeof fields.status === "string" ? fields.status : undefined, ms: fields.ms as number | undefined, run: fields.run as string | undefined, tokens_in: fields.tokens_in as number | undefined, tokens_out: fields.tokens_out as number | undefined, raw };
      } catch {
        return { n: index + 1, level: "RAW", msg: raw.slice(0, 120), raw };
      }
    });
  }
}

export const requestsIn = (lines: ServerLine[]) => lines.filter((line) => line.msg === "request");

export const modelCallsIn = (lines: ServerLine[]) => lines.filter((line) => line.msg === "test run model call");

export const secretLines = (lines: ServerLine[], needles: string[]): number[] =>
  lines.filter((line) => /Bearer\s+\S+|\bsk-[A-Za-z0-9_-]{12,}|\beyJ[A-Za-z0-9_-]{20,}|authorization/i.test(line.raw) || needles.some((needle) => needle !== "" && line.raw.includes(needle))).map((line) => line.n);

export type Stage = { name: string; ui: string; calls: string; server: string; tokens: string };

export const tally = (calls: Call[]): string => {
  const by = new Map<string, number>();
  for (const call of calls) {
    const key = `${call.method} ${call.path}${call.tool ? " " + call.tool : ""} ${call.status}`;
    by.set(key, (by.get(key) ?? 0) + 1);
  }
  return [...by.entries()].map(([key, n]) => `${n} x ${key}`).join("<br>");
};

export const findingsOfCalls = (calls: Call[], slowMs = 2000): Finding[] => {
  const out: Finding[] = [];
  for (const call of calls) {
    if (call.status >= 500) out.push({ what: `server error ${call.status}`, where: `${call.method} ${call.path} ${call.tool}`.trim(), evidence: `browser call in stage ${call.stage}`, severity: "high" });
    else if (call.status === 401 && call.path === "/auth/session") out.push({ what: "GET /auth/session answers 401 before sign-in (the app's own probe, expected)", where: `${call.method} ${call.path}`, evidence: `browser call in stage ${call.stage}`, severity: "low" });
    else if (call.status >= 400) out.push({ what: `the console got ${call.status}`, where: `${call.method} ${call.path} ${call.tool}`.trim(), evidence: `browser call in stage ${call.stage}`, severity: "medium" });
    if (call.ms > slowMs) out.push({ what: `slow call, ${call.ms} ms`, where: `${call.method} ${call.path} ${call.tool}`.trim(), evidence: `browser call in stage ${call.stage}`, severity: "low" });
  }
  return out;
};

export const findingsOfServer = (lines: ServerLine[], slowMs = 2000): Finding[] => {
  const out: Finding[] = [];
  for (const line of lines) {
    if (line.level === "ERROR" || /panic|goroutine \d+/i.test(line.raw)) out.push({ what: `${line.level} line: ${line.msg}`, where: "server log", evidence: `log line ${line.n}`, severity: "high" });
    else if (line.level === "WARN") out.push({ what: `WARN line: ${line.msg}`, where: "server log", evidence: `log line ${line.n}`, severity: "low" });
    if (line.msg === "request" && line.status === 401 && line.path === "/auth/session") continue;
    if (line.msg === "request" && (line.status ?? 0) >= 400) out.push({ what: `status ${line.status}`, where: `${line.method} ${line.path}`, evidence: `log line ${line.n}`, severity: (line.status ?? 0) >= 500 ? "high" : "medium" });
    if (line.msg === "request" && (line.ms ?? 0) > slowMs) out.push({ what: `slow request, ${line.ms} ms`, where: `${line.method} ${line.path}`, evidence: `log line ${line.n}`, severity: "low" });
    if (line.msg === "test run model call" && (line.ms ?? 0) > slowMs * 5) out.push({ what: `slow model call, ${line.ms} ms`, where: "Test agent model call", evidence: `log line ${line.n}`, severity: "low" });
  }
  return out;
};

const cell = (text: string): string => text.replace(/\|/g, "/").replace(/\n/g, " ");

export const renderMonitor = (title: string, intro: string[], stages: Stage[], backend: string[], findings: Finding[]): string => {
  const rows = stages.map((s) => `| ${cell(s.name)} | ${cell(s.ui)} | ${s.calls} | ${s.server} | ${cell(s.tokens)} |`);
  const issues = findings.length === 0 ? ["| none seen | | | |"] : findings.map((f) => `| ${cell(f.what)} | ${cell(f.where)} | ${cell(f.evidence)} | ${f.severity} |`);
  return [
    `# ${title}`,
    "",
    ...intro,
    "",
    "## Per stage",
    "",
    "| Stage | UI shown | Backend calls the console made | Server log lines | Tokens recorded |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    "## Read back from the backend after the run",
    "",
    ...backend.map((line) => `- ${line}`),
    "",
    "## Issues found",
    "",
    "| What | Where | Evidence | Severity |",
    "|---|---|---|---|",
    ...issues,
    "",
  ].join("\n");
};

export const writeMonitor = (path: string, text: string): void => writeFileSync(path, text);
