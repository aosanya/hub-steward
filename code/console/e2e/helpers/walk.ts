import { expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Settings } from "./env";
import { hubIdOf, Mcp } from "./mcp";
import {
  findingsOfCalls,
  findingsOfServer,
  modelCallsIn,
  Recorder,
  renderMonitor,
  requestsIn,
  secretLines,
  ServerLog,
  tally,
  writeMonitor,
  type Finding,
  type Stage,
} from "./monitor";
import { archiveDraft, freshDraft, seed, type Plan } from "./seed";

type Row = Record<string, unknown>;

export type Walk = {
  title: string;
  plan: Plan;
  draftDescription: string;
  monitorFile: string;
  shots: { signedIn: string; testPage: string; waiting: string; finished: string; failedStep: string };
};

export type StepRead = { actor: string; playedBy: string; did: string; recorded: string; step: string; tokens: number; failed: boolean };

const num = (value: unknown): number => (typeof value === "number" ? value : Number(value ?? 0) || 0);
const str = (value: unknown): string => (typeof value === "string" ? value : "");

const shot = async (page: Page, dir: string, name: string, full = true): Promise<void> => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(dir, name), fullPage: full });
};

const readSteps = async (page: Page): Promise<StepRead[]> => {
  const rows = page.getByRole("table").first().locator("tbody tr");
  const count = await rows.count();
  const out: StepRead[] = [];
  for (let i = 0; i < count; i++) {
    const cells = await rows.nth(i).locator("td").allInnerTexts();
    const [who = "", did = "", recorded = "", step = "", tokens = "0"] = cells;
    const [actor = "", playedBy = ""] = who.split("\n").map((part) => part.trim());
    out.push({ actor, playedBy, did: did.trim(), recorded: recorded.trim(), step: step.replace(/\s+/g, " ").trim(), tokens: Number(tokens.replace(/[^\d]/g, "")) || 0, failed: /Failed/.test(step) });
  }
  return out;
};

const openMenu = async (page: Page, name: string): Promise<void> => {
  await page.getByRole("link", { name, exact: true }).first().click();
};

const scenarioCard = (page: Page, name: string): Locator => page.locator(".card", { hasText: name }).last();

export const walkTheTest = async (page: Page, s: Settings, walk: Walk): Promise<{ findings: Finding[]; steps: StepRead[]; runId: string }> => {
  mkdirSync(s.shotsDir, { recursive: true });
  const hub = await hubIdOf(s);
  const mcp = await (await new Mcp(s, hub).signIn()).open();
  const account = await mcp.tool<Row>("ai_get_default_account");
  expect(str(account.name), "the agency's default AI account is Muse").toContain("Muse");
  const existing = await findScenario(mcp, walk.plan.scenario.name);
  const draftId = existing ? existing.draftId : await freshDraft(mcp, walk.draftDescription);
  const recorder = new Recorder();
  recorder.attach(page);
  const log = new ServerLog(s.serverLog);
  const began = log.mark();
  const stages: Stage[] = [];
  const findings: Finding[] = [];
  try {
    if (!existing) await seed(mcp, draftId, walk.plan);

    const stage = async (name: string, ui: string, mark: number, tokens = ""): Promise<void> => {
      const lines = log.since(mark);
      stages.push({ name, ui, calls: tally(recorder.in(name)), server: `${requestsIn(lines).length} requests, ${modelCallsIn(lines).length} model calls`, tokens });
    };

    recorder.stage = "1 sign in";
    let mark = log.mark();
    await page.goto("/#/login");
    await page.getByLabel("Email").fill(s.email);
    await page.getByLabel("Password").fill(s.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).not.toHaveURL(/#\/login/);
    await expect(page.getByRole("heading").first()).toBeVisible();
    if (/#\/hubs/.test(page.url())) await expect(page.getByText(s.hubName).first()).toBeVisible();
    await shot(page, s.shotsDir, walk.shots.signedIn);
    await stage("1 sign in", `signed in, landed on ${page.url().split("#")[1] ?? "/"}`, mark);
    expect.soft(recorder.in("1 sign in").some((call) => call.path === "/auth/signin" && call.status === 201 || call.status === 200), "the sign-in request answered").toBe(true);
    expect.soft(requestsIn(log.since(mark)).some((line) => line.path === "/auth/signin" && (line.status ?? 0) < 300), "the server logged the sign-in").toBe(true);

    recorder.stage = "2 Test page";
    mark = log.mark();
    if (/#\/hubs/.test(page.url())) {
      await page.locator(".card", { hasText: s.hubName }).getByRole("link", { name: "Open" }).first().click();
    }
    await expect(page).toHaveURL(/\/h\//);
    await openMenu(page, "Test");
    await expect(scenarioCard(page, walk.plan.scenario.name)).toBeVisible();
    await shot(page, s.shotsDir, walk.shots.testPage);
    await stage("2 Test page", `Test page lists "${walk.plan.scenario.name}" with a Run action`, mark);
    expect.soft(recorder.count("2 Test page", "agency_list_scenarios"), "the Test page asked for the scenarios").toBeGreaterThan(0);

    recorder.stage = "3 run waiting";
    mark = log.mark();
    const card = scenarioCard(page, walk.plan.scenario.name);
    await card.getByRole("button", { name: "Actions" }).click();
    await card.getByRole("menuitem", { name: /^Run/ }).click();
    await expect(page).toHaveURL(/[?&]run=/);
    const runId = new URLSearchParams(page.url().split("?")[1] ?? "").get("run") ?? "";
    await expect(page.getByRole("heading", { name: "What transpired" })).toBeVisible();
    await shot(page, s.shotsDir, walk.shots.waiting);
    const activeAtFirstSight = await page.getByRole("button", { name: "Stop" }).isVisible();
    await stage("3 run waiting", activeAtFirstSight ? "run page open, Stop offered (run still active)" : "run page open, already over at first sight", mark);
    expect.soft(recorder.count("3 run waiting", "agency_run_scenario"), "pressing Run sent one run-scenario request").toBe(1);

    recorder.stage = "4 run finished";
    mark = log.mark();
    const timeline: string[] = [];
    const began4 = Date.now();
    while (activeAtFirstSight && (await page.getByRole("button", { name: "Stop" }).isVisible()) && Date.now() - began4 < 12 * 60 * 1000) {
      const text = await page.locator(".content").innerText();
      const tokens = /Tokens\s+([\d,]+|—)/.exec(text)?.[1] ?? "?";
      const result = /Result\s+(\w[\w ]*)/.exec(text)?.[1]?.split("\n")[0] ?? "?";
      const rowsShown = (await page.getByRole("table").first().locator("tbody tr").count());
      timeline.push(`t+${Math.round((Date.now() - began4) / 1000)}s: page says ${result}, Tokens ${tokens}, ${rowsShown} step rows; model calls logged since pressing Run: ${modelCallsIn(log.since(mark)).length}`);
      await page.waitForTimeout(4000);
    }
    await page.setViewportSize({ width: 1440, height: 1800 });
    await page.waitForTimeout(1500);
    const steps = await readSteps(page);
    expect(steps.length, "the run page lists the steps").toBeGreaterThan(0);
    await shot(page, s.shotsDir, walk.shots.finished);
    const failed = page.getByRole("table").first().locator("tbody tr", { hasText: "Failed" }).first();
    if (await failed.count()) {
      await failed.scrollIntoViewIfNeeded();
      await expect(failed).toContainText("Expected");
      await expect(failed).toContainText("Found");
      await page.screenshot({ path: join(s.shotsDir, walk.shots.failedStep), fullPage: true });
    }
    const shownTokens = steps.reduce((sum, step) => sum + step.tokens, 0);
    await stage("4 run finished", `${steps.length} steps listed, ${steps.filter((step) => step.failed).length} failed, tokens ${shownTokens}`, mark, String(shownTokens));
    expect.soft(recorder.count("4 run finished", "agency_get_test_run"), "the console polled the run while it ran").toBeGreaterThan(0);

    const settled = recorder.count("4 run finished", "agency_get_test_run");
    await page.waitForTimeout(7000);
    expect.soft(recorder.count("4 run finished", "agency_get_test_run"), "the poll stopped once the run was over").toBe(settled);
    expect.soft(recorder.unanswered, "every console call was answered").toBe(0);
    expect.soft(recorder.failed, "no console call failed").toEqual([]);

    const run = await mcp.tool<Row>("agency_get_test_run", { test_run_id: runId });
    const backendSteps = (Array.isArray(run.steps) ? run.steps : []) as Row[];
    const backendTokens = backendSteps.reduce((sum, step) => sum + num(step.tokens), 0);
    const usage = await mcp.tool<Row>("ai_list_test_run_usage", { testRunID: runId });
    const usageSteps = (Array.isArray(usage.steps) ? usage.steps : []) as Row[];
    const usageOut = num(usage.tokens);
    const modelCalls = modelCallsIn(log.all()).filter((line) => line.run === runId);
    const loggedTokens = modelCalls.reduce((sum, line) => sum + num(line.tokens_in) + num(line.tokens_out), 0);
    const failedCalls = modelCalls.filter((line) => line.outcome !== "ok");
    const backend = [
      `run ${runId}: result ${str(run.result)} ${str(run.stop_reason)}`.trim(),
      `run page shows ${shownTokens} tokens; the run read back from the backend carries ${num(run.tokens)} in total and ${backendTokens} across ${backendSteps.length} steps`,
      `AI usage for the test run: ${num(usage.requests)} requests, ${usageOut} tokens, per step ${usageSteps.map((step) => `${str(step.step)} ${num(step.requests)} req ${num(step.tokens)} tok`).join("; ") || "none"}`,
      `model calls the server logged for this run: ${modelCalls.length} (${failedCalls.length} failed), ${loggedTokens} tokens`,
      `what the run page showed while the run was active: ${timeline.length === 0 ? "nothing sampled" : "<br>" + timeline.join("<br>")}`,
      `default AI account: ${str(account.name)} (${str(account.model_name)})`,
    ];
    expect.soft(shownTokens, "tokens on the run page equal the tokens the backend recorded for the run").toBe(num(run.tokens));
    expect.soft(usageOut, "the AI usage for the run adds up to the run's tokens, counted once").toBe(num(run.tokens));
    if (usageOut !== num(run.tokens)) findings.push({ what: `AI usage for the run is ${usageOut} tokens in ${num(usage.requests)} requests; the run shows ${num(run.tokens)}`, where: "ai_list_test_run_usage against agency_get_test_run", evidence: `run ${runId}`, severity: "medium" });
    expect.soft(num(usage.requests), "every model call of the run was recorded once").toBe(modelCalls.length);
    if (num(usage.requests) !== modelCalls.length) findings.push({ what: `the server logged ${modelCalls.length} model calls (${loggedTokens} tokens) but usage recorded ${num(usage.requests)} requests (${usageOut} tokens)`, where: "AI usage recording for test runs", evidence: `run ${runId}`, severity: "high" });
    if (/SQLSTATE|ERROR:/.test(str(run.stop_reason))) findings.push({ what: "the run's stop reason shows a raw database error to the designer", where: "run page Result, agency_get_test_run stop_reason", evidence: `run ${runId}: ${str(run.stop_reason)}`, severity: "high" });

    const live = await liveMarketRows(mcp, walk.plan.scenario.actors.map((actor) => actor.name));
    backend.push(...live.lines);
    expect.soft(live.rows, "the live market holds none of the run's rows").toBe(0);
    if (live.rows > 0) findings.push({ what: `${live.rows} rows of the test run sit in the live market`, where: "live market tables", evidence: live.lines.join("; "), severity: "high" });

    const refreshed = await mcp.tool<Row>("agency_get_test_run", { test_run_id: runId });
    expect.soft(["passed", "failed", "stopped"], "the run is not left running or waiting").toContain(str(refreshed.result));
    if (!["passed", "failed", "stopped"].includes(str(refreshed.result))) findings.push({ what: `run left ${str(refreshed.result)}`, where: "agency_get_test_run", evidence: `run ${runId}`, severity: "high" });

    findings.push(...findingsOfCalls(recorder.calls));
    const lines = log.all();
    findings.push(...findingsOfServer(lines.filter((line) => line.n > began)));
    const bootWarnings = lines.filter((line) => line.n <= began && line.level === "WARN");
    if (bootWarnings.length > 0) findings.push({ what: `${bootWarnings.length} WARN lines at boot: ${bootWarnings.map((line) => line.msg).join("; ")}`, where: "server log", evidence: `log lines ${bootWarnings.map((line) => line.n).join(", ")}`, severity: "low" });
    const polls = recorder.count("4 run finished", "agency_get_test_run") + recorder.count("3 run waiting", "agency_get_test_run");
    const listings = recorder.count("4 run finished", "agency_list_test_runs") + recorder.count("3 run waiting", "agency_list_test_runs");
    if (polls > 0 && listings >= polls) findings.push({ what: `every poll of the run also re-reads the run list (${polls} polls, ${listings} list calls)`, where: "console run page poll (agency_get_test_run + agency_list_test_runs)", evidence: "browser calls in stages 3 and 4", severity: "low" });
    const leaked = secretLines(lines, [s.password]);
    if (leaked.length > 0) findings.push({ what: "something that looks like a secret in the server log", where: "server log", evidence: `log lines ${leaked.join(", ")}`, severity: "high" });
    expect.soft(leaked, "no secret in the server log").toEqual([]);

    const intro = [`Run on ${new Date().toISOString()} against ${s.hubName}, played by ${str(account.name)}.`, `Console: ${s.baseURL}. Scenario: ${walk.plan.scenario.name}.`, "Calls are the browser's own (method, path, tool, status); log lines are the server's request log (method, path, status, duration only)."];
    writeMonitor(join(s.shotsDir, walk.monitorFile), renderMonitor(walk.title, intro, stages, backend, dedupe(findings)));
    return { findings, steps, runId };
  } finally {
    if (!existing && !process.env.E2E_KEEP_DRAFT) await archiveDraft(mcp, draftId).catch(() => undefined);
  }
};

type Found = { draftId: string; scenarioId: string };

const findScenario = async (mcp: Mcp, name: string): Promise<Found | null> => {
  for (const draft of await mcp.items("agency_list_drafts", { status: "open" })) {
    const hit = (await mcp.items("agency_list_scenarios", { draft_id: String(draft.id) })).find((scenario) => scenario.name === name);
    if (hit) return { draftId: String(draft.id), scenarioId: String(hit.id) };
  }
  return null;
};

const dedupe = (findings: Finding[]): Finding[] => {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.what}|${f.where}|${f.evidence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const liveMarketRows = async (mcp: Mcp, names: string[]): Promise<{ rows: number; lines: string[] }> => {
  const lines: string[] = [];
  let rows = 0;
  for (const tool of ["market_list_posters", "market_list_offers", "market_list_asks"]) {
    try {
      const items = await mcp.items(tool);
      const mine = items.filter((row) => names.some((name) => JSON.stringify(row).includes(name)));
      rows += mine.length;
      lines.push(`live ${tool}: ${items.length} rows, ${mine.length} naming the scenario's actors`);
    } catch (error) {
      lines.push(`live ${tool}: not readable (${(error as Error).message.slice(0, 120)})`);
    }
  }
  return { rows, lines };
};
