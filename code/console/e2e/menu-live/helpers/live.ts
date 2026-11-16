import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { pickAgency, type HeldAgency } from "./pickAgency";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../../..");
const screenshotsDir = resolve(repoRoot, "documentation/4. qa/testing/03-screenshots/menu-live");

const runMarkersDir = resolve(tmpdir(), "hubsteward-menu-live-runs");

export const qaFolder = "/tmp/hubsteward-qa";
export const apiUrl = "http://127.0.0.1:8183";
export const appUrl = "http://127.0.0.1:5181";
export const sessionCookie = "wakala_session";

type Person = { who: string; cookie: string; agency: string; agencyName: string };
type Session = { who: string; cookie: string; agencies: HeldAgency[] };

const people = new Map<string, Promise<Session>>();
let wantedAgencyName: string | undefined;
const mcpSessions = new Map<string, Promise<string>>();
let nextId = 0;

const jarPath = (who: string) => `${qaFolder}/${who}.cookies`;
const passwordPath = (who: string) => `${qaFolder}/${who}.password`;

const cookieFromJar = (who: string) => {
  if (!existsSync(jarPath(who))) return "";
  const line = readFileSync(jarPath(who), "utf8")
    .split("\n")
    .find((row) => row.includes(`\t${sessionCookie}\t`));
  return line ? line.split("\t")[6].trim() : "";
};

const whoAmI = async (cookie: string) => {
  const reply = await fetch(`${apiUrl}/me`, { headers: { Cookie: `${sessionCookie}=${cookie}` } });
  return reply.ok ? ((await reply.json()) as { agencies: HeldAgency[] }) : null;
};

const writeJar = (who: string, cookie: string) =>
  writeFileSync(
    jarPath(who),
    `# Netscape HTTP Cookie File\n#HttpOnly_127.0.0.1\tFALSE\t/\tFALSE\t0\t${sessionCookie}\t${cookie}\n`,
  );

const signInOnce = async (who: string): Promise<Session> => {
  let cookie = cookieFromJar(who);
  let me = cookie ? await whoAmI(cookie) : null;
  if (!me) {
    if (!existsSync(passwordPath(who))) throw new Error(`${who}: no live session in ${jarPath(who)} and no ${passwordPath(who)}`);
    const reply = await fetch(`${apiUrl}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `${who}@local.test`, password: readFileSync(passwordPath(who), "utf8").trim() }),
    });
    if (reply.status !== 201) throw new Error(`${who}: sign-in answered ${reply.status}; stop and record the step as blocked`);
    const setCookie = reply.headers.getSetCookie().find((value) => value.startsWith(`${sessionCookie}=`)) ?? "";
    cookie = setCookie.slice(sessionCookie.length + 1).split(";")[0];
    writeJar(who, cookie);
    me = await whoAmI(cookie);
  }
  return { who, cookie, agencies: me?.agencies ?? [] };
};

export const agencyNamed = (name?: string): void => {
  wantedAgencyName = name;
};

export const person = async (who: string): Promise<Person> => {
  if (!people.has(who)) people.set(who, signInOnce(who));
  const session = await (people.get(who) as Promise<Session>);
  const agency = pickAgency(session.agencies, wantedAgencyName);
  return { who, cookie: session.cookie, agency: agency.id, agencyName: agency.name };
};

export const signIn = async (page: Page, who: string): Promise<Person> => {
  const signedIn = await person(who);
  await page.context().addCookies([{ name: sessionCookie, value: signedIn.cookie, domain: "127.0.0.1", path: "/" }]);
  await page.addInitScript((agency) => {
    try {
      sessionStorage.setItem("hubsteward.openAgency", agency);
    } catch {
      return;
    }
  }, signedIn.agency);
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    let pending = 0;
    let lastActivity = performance.now();
    window.fetch = (...args) => {
      pending += 1;
      lastActivity = performance.now();
      return original(...args).finally(() => {
        pending -= 1;
        lastActivity = performance.now();
      });
    };
    (window as any).appFetchesAreQuiet = () => pending === 0 && performance.now() - lastActivity > 500;
  });
  await page.goto("/");
  const agree = page.getByRole("button", { name: "Agree" });
  const home = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Notifications/ });
  const fetchesQuiet = () =>
    page.waitForFunction(() => (window as any).appFetchesAreQuiet?.() === true, undefined, { timeout: 30_000 });
  await agree.or(home).first().waitFor({ timeout: 30_000 });
  await fetchesQuiet();
  if (await agree.isVisible()) {
    await agree.click();
    await home.waitFor({ timeout: 30_000 });
    await fetchesQuiet();
  }
  return signedIn;
};

const mcpPost = (cookie: string, session: string, body: unknown) =>
  fetch(`${apiUrl}/mcp`, {
    method: "POST",
    headers: {
      Cookie: `${sessionCookie}=${cookie}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(session ? { "Mcp-Session-Id": session } : {}),
    },
    body: JSON.stringify(body),
  });

const messageFrom = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const line = text.split("\n").find((row) => row.startsWith("data:"));
  if (!line) throw new Error("the tool answer carried no message");
  return JSON.parse(line.slice(5).trim());
};

const mcpSession = (signedIn: Person): Promise<string> => {
  if (!mcpSessions.has(signedIn.who)) {
    mcpSessions.set(
      signedIn.who,
      (async () => {
        const opened = await mcpPost(signedIn.cookie, "", {
          jsonrpc: "2.0",
          id: ++nextId,
          method: "initialize",
          params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "menu-live", version: "1" } },
        });
        if (!opened.ok) throw new Error(`${signedIn.who}: the hub answered ${opened.status} to initialize`);
        const session = opened.headers.get("Mcp-Session-Id") ?? "";
        await mcpPost(signedIn.cookie, session, { jsonrpc: "2.0", method: "notifications/initialized" });
        return session;
      })(),
    );
  }
  return mcpSessions.get(signedIn.who) as Promise<string>;
};

export const post = async <T = any>(who: string, tool: string, args: Record<string, unknown> = {}): Promise<T> => {
  const signedIn = await person(who);
  const session = await mcpSession(signedIn);
  const reply = await mcpPost(signedIn.cookie, session, {
    jsonrpc: "2.0",
    id: ++nextId,
    method: "tools/call",
    params: { name: tool, arguments: { instance_id: signedIn.agency, ...args } },
  });
  if (!reply.ok) throw new Error(`${tool}: the hub answered ${reply.status}`);
  const message = messageFrom(await reply.text());
  if (message.error) throw new Error(`${tool}: ${message.error.message}`);
  const result = message.result ?? {};
  if (result.isError) throw new Error(`${tool}: ${result.content?.[0]?.text ?? ""}`);
  if (result.structuredContent) return result.structuredContent as T;
  const text = result.content?.[0]?.text;
  return (text ? JSON.parse(text) : {}) as T;
};

export type Undo = { tool: string; args: Record<string, unknown> };

export const defaultWho = "own14";

export type Journey = {
  prefix: string;
  who: string;
  agencyId: string;
  named: (name: string) => string;
  post: <T = any>(tool: string, args?: Record<string, unknown>, undo?: Undo | ((result: T) => Undo)) => Promise<T>;
};

const undosByJourney = new Map<string, { who: string; undos: Undo[] }>();

export const seedJourney = async (journey: string, who: string = defaultWho): Promise<Journey> => {
  const signedIn = await person(who);
  const held = { who, undos: [] as Undo[] };
  undosByJourney.set(journey, held);
  return {
    prefix: journey,
    who,
    agencyId: signedIn.agency,
    named: (item) => `${journey} ${item}`,
    post: async (tool, args = {}, undo) => {
      const result = await post(who, tool, args);
      if (undo) held.undos.push(typeof undo === "function" ? undo(result) : undo);
      return result;
    },
  };
};

export const cleanup = async (journey: string | Journey): Promise<void> => {
  const name = typeof journey === "string" ? journey : journey.prefix;
  const held = undosByJourney.get(name);
  if (!held) return;
  for (const undo of held.undos.splice(0).reverse()) await post(held.who, undo.tool, undo.args);
};

const startRun = (folder: string): void => {
  mkdirSync(folder, { recursive: true });
  mkdirSync(runMarkersDir, { recursive: true });
  const marker = resolve(runMarkersDir, `${basename(folder)}.run`);
  const runId = String(process.ppid);
  if (existsSync(marker) && readFileSync(marker, "utf8") === runId) return;
  readdirSync(folder).filter((file) => file.endsWith(".png")).forEach((file) => rmSync(resolve(folder, file)));
  writeFileSync(marker, runId);
};

export const shootLive = async (page: Page, journey: string, step: string): Promise<string> => {
  const folder = resolve(screenshotsDir, journey);
  startRun(folder);
  const number = readdirSync(folder).filter((file) => file.endsWith(".png")).length + 1;
  const path = resolve(folder, `${String(number).padStart(2, "0")}-${step}.png`);
  await page.screenshot({ path });
  return path;
};

const qaDatabase = `${qaFolder}/hub.db`;
const overdueJourneyPrefix = "03-overdue";
const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const sql = (statement: string): string =>
  execFileSync("sqlite3", ["-cmd", ".timeout 5000", qaDatabase, statement], { encoding: "utf8" }).trim();

const raisedItemTables = (): string[] =>
  sql("select name from sqlite_master where type='table' and name not like '%\\_test' escape '\\' and sql like '%follow_key_hash%'")
    .split("\n")
    .filter(Boolean);

export const backdateRaisedItem = (raisedItemId: string, days: number): number => {
  if (!uuidShape.test(raisedItemId)) throw new Error(`backdateRaisedItem: ${raisedItemId} is not an id`);
  if (!Number.isInteger(days) || days < 1) throw new Error(`backdateRaisedItem: ${days} is not a whole number of days`);
  const tables = raisedItemTables();
  if (tables.length === 0) throw new Error(`backdateRaisedItem: no raised item table in ${qaDatabase}`);
  const holding = tables.filter(
    (table) => sql(`select count(*) from "${table}" where id = '${raisedItemId}' and title like '${overdueJourneyPrefix} %'`) === "1",
  );
  if (holding.length !== 1) {
    throw new Error(`backdateRaisedItem: ${raisedItemId} is a ${overdueJourneyPrefix} issue in ${holding.length} of ${tables.length} raised item tables of ${qaDatabase}, expected 1`);
  }
  const touched = sql(
    `update "${holding[0]}" set created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at, '-${days} days') where id = '${raisedItemId}' and title like '${overdueJourneyPrefix} %'; select changes();`,
  );
  if (touched !== "1") throw new Error(`backdateRaisedItem: ${raisedItemId} was not updated in ${qaDatabase}`);
  return Number(touched);
};
