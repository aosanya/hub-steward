import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { settings, type Settings } from "./helpers/env";
import { hubIdOf, Mcp } from "./helpers/mcp";
import { findingsOfCalls, findingsOfServer, Recorder, renderMonitor, secretLines, ServerLog, writeMonitor, type Finding } from "./helpers/monitor";
import { sellHarvest } from "./helpers/plans";
import {
  button,
  cards,
  carriedFindings,
  dedupe,
  describeReview,
  entryOf,
  expectCards,
  expectMenuOrder,
  expectPartPage,
  farmersAreas,
  findingsOfReviewLog,
  findingTitled,
  openCount,
  openPart,
  openPartByCard,
  openReview,
  partOf,
  partTokens,
  progress,
  progressPattern,
  readReview,
  recordOnePart,
  reviewMenu,
  reviewTimeout,
  rows,
  sentencesIn,
  signInAndOpenHub,
  Stages,
  topMenu,
  waitForCards,
  type ReviewRead,
} from "./helpers/review";
import { archiveDraft, freshDraft, seed } from "./helpers/seed";

type Row = Record<string, unknown>;

const monitorFile = "backend-monitor-review-an-agency.md";
const pollWindow = 9000;

const str = (value: unknown): string => (typeof value === "string" ? value : "");

const shot = async (page: Page, s: Settings, name: string): Promise<void> => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(s.shotsDir, name), fullPage: true });
};

const required = async (mcp: Mcp, draftId: string): Promise<ReviewRead> => {
  const review = await readReview(mcp, draftId);
  if (!review) throw new Error("the draft has no review");
  return review;
};

test("Review an agency: run, read, answer, comment, run again, apply, see a failed part", async ({ page }) => {
  test.setTimeout(2 * reviewTimeout + 10 * 60 * 1000);
  const s = settings();
  mkdirSync(s.shotsDir, { recursive: true });
  const hub = await hubIdOf(s);
  const mcp = await (await new Mcp(s, hub).signIn()).open();
  const account = await mcp.tool<Row>("ai_get_default_account");
  expect(str(account.name), "the agency has a default AI account for the reviewers to read with").not.toBe("");

  const draftId = await freshDraft(mcp, "Review test");
  const recorder = new Recorder();
  recorder.attach(page);
  const log = new ServerLog(s.serverLog);
  const began = log.mark();
  const stages = new Stages(recorder, log);
  const findings: Finding[] = [];
  const backend: string[] = [`default AI account: ${str(account.name)} (${str(account.model_name)})`];

  try {
    await seed(mcp, draftId, sellHarvest);
    const open = await mcp.items("agency_list_drafts", { status: "open" });
    expect(str(open.at(-1)?.id), "the console works on the newest open draft, and that is the test's draft").toBe(draftId);

    stages.begin("0 sign in");
    await signInAndOpenHub(page, s);
    stages.end(`signed in, landed on ${page.url().split("#")[1] ?? "/"}`);

    stages.begin("1 opens Review");
    await openReview(page);
    await expect(page.locator(".empty", { hasText: "This draft has not been reviewed yet." }).getByRole("button", { name: "Run review", exact: true })).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await expectMenuOrder(page);
    expect(await readReview(mcp, draftId), "the database holds no review of the new draft").toBeNull();
    await shot(page, s, "review-01-empty.png");
    stages.end("Review above Publish with a divider and the seven parts under it; one card says the draft has not been reviewed and carries Run review");

    stages.begin("2 runs the review");
    await button(page, "Run review").click();
    await expect(progress(page)).toContainText(progressPattern);
    await expect(cards(page)).toHaveCount(0);
    const running = await required(mcp, draftId);
    expect(running.status, "the database holds the review as running").toBe("running");
    expect(running.parts, "one reviewer for each part of a farmers' agency").toHaveLength(farmersAreas.length);
    await shot(page, s, "review-02-progress.png");

    await topMenu(page).filter({ hasText: /^Workflows/ }).click();
    await expect(page).toHaveURL(/\/h\/[^/]+\/workflows$/);
    await openReview(page);
    await expect(progress(page), "coming back finds the same run still reading").toContainText(progressPattern);
    expect((await required(mcp, draftId)).id, "it is the same run").toBe(running.id);

    await waitForCards(page);
    const first = await required(mcp, draftId);
    expect(first.id).toBe(running.id);
    expect(first.status, "every reviewer has reported").toBe("done");
    expect.soft(first.tokens, "the review adds up the tokens of its parts").toBe(partTokens(first));
    backend.push(describeReview("first review", first));
    await expectCards(page, first);
    await expect(button(page, "Run review again")).toBeVisible();
    await expectMenuOrder(page);
    const settledPolls = stages.count("agency_get_review");
    await page.waitForTimeout(pollWindow);
    expect(stages.count("agency_get_review") - settledPolls, "the page stopped polling once every reviewer had finished").toBeLessThan(3);
    expect.soft(stages.count("agency_run_review"), "pressing Run review sent one run request").toBe(1);
    expect.soft(stages.count("agency_get_review"), "the page polled the review while it ran").toBeGreaterThan(0);
    await shot(page, s, "review-02b-cards.png");
    stages.end(`progress card while reading, same run after leaving and coming back, then ${farmersAreas.length} cards`, String(first.tokens));

    stages.begin("3 reads a part");
    const readable = farmersAreas.findIndex((entry) => {
      const part = first.parts.find((candidate) => candidate.area === entry.area);
      return part !== undefined && part.status === "done" && openCount(part) > 0;
    });
    expect(readable, "some part of the first review carries a finding that is open").toBeGreaterThanOrEqual(0);
    const entry = farmersAreas[readable];
    const readPart = partOf(first, entry.area);
    await openPartByCard(page, entry);
    await expectPartPage(page, readPart);
    expect.soft(sentencesIn(readPart.summary), "the part opens with a two-sentence summary").toBe(2);
    const row = rows(page).first();
    const title = (await row.locator("h2").innerText()).trim();
    await expect(button(row, "Details")).toBeVisible();
    await expect(button(row, "Dismiss")).toBeVisible();
    await expect(button(row, "Add a note")).toBeVisible();
    await shot(page, s, "review-03-a-part.png");
    stages.end(`${entry.label} opened from its card: summary and ${readPart.findings.length} finding rows as the database holds them`);

    stages.begin("4a answers a finding");
    await button(row, "Ask the chat about this").click();
    await expect(row.getByPlaceholder("Ask the chat about this")).toBeVisible();
    await button(row, "Ask the chat about this").click();
    await button(row, "Details").click();
    await expect(page.getByRole("combobox", { name: "Details", exact: true })).toBeVisible();
    await expect(page.locator(".kept")).toBeHidden();
    await page.locator("nav.review-tabs button.tab").first().click();
    await expect(page.locator(".kept")).toBeVisible();

    await button(row, "Dismiss").click();
    await expect(button(row, "Reopen")).toBeVisible();
    await expect(button(row, "Dismiss")).toHaveCount(0);
    await expect(button(row, "Ask the chat about this")).toHaveCount(0);
    const dismissed = await required(mcp, draftId);
    expect(findingTitled(partOf(dismissed, entry.area), title).status, "the database holds the finding as dismissed").toBe("dismissed");
    expect.soft(stages.count("agency_set_finding_status"), "Dismiss sent one status change").toBe(1);
    await page.reload();
    await expect(page.getByRole("heading", { name: `Review: ${entry.label}`, exact: true })).toBeVisible();
    await expect(button(rows(page).first(), "Reopen"), "the dismissal survives a reload").toBeVisible();
    await shot(page, s, "review-04-dismissed.png");
    await openReview(page);
    await waitForCards(page);
    await expectCards(page, dismissed);
    stages.end(`${title}: Ask opened its box, Details opened a tab, Dismiss saved and survived a reload; the ${entry.label} card follows the count`);

    stages.begin("5 comments on a finding");
    await openPart(page, entry);
    const noted = rows(page).first();
    await expect(noted.locator("h2")).toContainText(title);
    await button(noted, "Add a note").click();
    const note = `Kept on purpose, ${Date.now()}`;
    await noted.getByPlaceholder("A note for the next review").fill(note);
    await button(noted, "Save note").click();
    await expect(noted.locator(".finding-notes li", { hasText: note })).toBeVisible();
    expect.soft(stages.count("agency_comment_finding"), "Save note sent one comment").toBe(1);
    const commented = findingTitled(partOf(await required(mcp, draftId), entry.area), title);
    expect(commented.notes.map((each) => each.body), "the database holds the note").toContain(note);
    const author = commented.notes.find((each) => each.body === note)?.author ?? "";
    if (author === "") findings.push({ what: "a saved note carries no author, so the list under the finding shows an empty name", where: "agency_comment_finding, called without an author by the console", evidence: `finding ${commented.id}`, severity: "low" });
    await shot(page, s, "review-05-note.png");
    await page.reload();
    await expect(noted.locator(".finding-notes li", { hasText: note }), "the note survives a reload").toBeVisible();
    stages.end(`note saved on the dismissed ${title}${author === "" ? ", shown without an author" : ` by ${author}`}, and shown again after a reload`);

    stages.begin("6 runs the review again");
    await openReview(page);
    await button(page, "Run review again").click();
    await expect(progress(page)).toContainText(progressPattern);
    await waitForCards(page);
    const second = await required(mcp, draftId);
    expect(second.id, "the second review is a new one").not.toBe(first.id);
    expect(second.status).toBe("done");
    expect(second.previousId, "the second review reads the first").toBe(first.id);
    expect.soft(second.tokens, "the review adds up the tokens of its parts").toBe(partTokens(second));
    expect.soft(stages.count("agency_run_review"), "Run review again sent one run request").toBe(1);
    backend.push(describeReview("second review", second));
    const carried = carriedFindings(second);
    expect(carried.length, "the second review gives an earlier finding its fate").toBeGreaterThan(0);
    const fates = [...new Set(carried.map((finding) => finding.fate))].join(", ");
    const heldNote = second.parts.flatMap((part) => part.findings).find((finding) => finding.carriedFrom === commented.id);
    backend.push(`${carried.length} of the second review's findings answer an earlier one, with fates ${fates}; the dismissed finding with the note came back ${heldNote ? `${heldNote.fate}, ${heldNote.status}` : "unanswered"}`);
    if (!heldNote) findings.push({ what: "the dismissed finding with a note was not answered in the second review", where: "review runner, agency_review_input", evidence: `finding ${commented.id}`, severity: "medium" });
    const input = await mcp.tool<Row>("agency_review_input", { review_id: second.id, area: entry.area });
    const read = (Array.isArray(input.previous) ? input.previous : []).flatMap((each) => (Array.isArray((each as Row).comments) ? ((each as Row).comments as Row[]) : []));
    expect(read.map((each) => str(each.body)), "the second review is handed the designer's note").toContain(note);
    await expectCards(page, second);
    for (const each of farmersAreas) {
      await openPart(page, each);
      await expectPartPage(page, partOf(second, each.area));
    }
    await shot(page, s, "review-06-fates.png");
    stages.end(`${carried.length} earlier findings answered (${fates}); every part page matches the second review`, String(second.tokens));

    stages.begin("4b applies a finding");
    const goalTitle = `Review test goal ${Date.now()}`;
    const proposal = `Add the goal ${goalTitle}`;
    await recordOnePart(mcp, draftId, "goals", {
      kind: "done",
      summary: "The goals read clearly. One goal the review test needs is missing.",
      findings: [{ title: proposal, detail: "The draft has no goal for the review test.", tool: "agency_create_goal", arguments: { title: goalTitle } }],
    });
    const proposed = await required(mcp, draftId);
    await page.reload();
    await openPart(page, entryOf("goals"));
    await expectPartPage(page, partOf(proposed, "goals"));
    const proposing = rows(page).first();
    await expect(proposing.locator("h2")).toContainText(proposal);
    await button(proposing, "Apply").click();
    await expect(button(proposing, "Apply")).toHaveCount(0);
    await expect(button(proposing, "Dismiss")).toHaveCount(0);
    await expect(button(proposing, "Add a note")).toBeVisible();
    const applied = await required(mcp, draftId);
    expect(findingTitled(partOf(applied, "goals"), proposal).status, "the database holds the finding as applied").toBe("applied");
    const goals = await mcp.items("agency_list_goals", { draft_id: draftId });
    expect(goals.map((goal) => str(goal.title)), "Apply changed the draft").toContain(goalTitle);
    expect.soft(stages.count("agency_create_goal"), "Apply made the change once").toBe(1);
    expect.soft(stages.count("agency_set_finding_status"), "Apply marked the finding once").toBe(1);
    await shot(page, s, "review-04b-applied.png");
    await openReview(page);
    await waitForCards(page);
    await expectCards(page, applied);
    backend.push(`the Goals part was re-recorded through agency_record_review_area with one finding that calls agency_create_goal; Apply created the goal "${goalTitle}" and the finding is ${findingTitled(partOf(applied, "goals"), proposal).status}`);
    stages.end(`Apply on a recorded finding created the goal "${goalTitle}" in the draft and marked the finding applied`);

    stages.begin("7 finds a part that failed");
    const reason = "The reviewer could not finish this part.";
    await recordOnePart(mcp, draftId, "risks", { kind: "failed", reason });
    const failed = await required(mcp, draftId);
    expect(partOf(failed, "risks").status, "the database holds the Risks part as failed").toBe("failed");
    expect(partOf(failed, "risks").failureReason).toBe(reason);
    for (const each of farmersAreas.filter((candidate) => candidate.area !== "risks")) {
      expect(
        partOf(failed, each.area).findings.map((finding) => finding.id),
        `the ${each.label} part keeps its findings`,
      ).toEqual(partOf(applied, each.area).findings.map((finding) => finding.id));
    }
    backend.push(`the Risks part was recorded failed through agency_record_review_area: "${reason}"`);
    await page.reload();
    await openReview(page);
    await waitForCards(page);
    await expectCards(page, failed);
    const risks = entryOf("risks");
    await openPartByCard(page, risks);
    await expectPartPage(page, partOf(failed, "risks"));
    await shot(page, s, "review-07-failed-part.png");
    for (const each of farmersAreas.filter((candidate) => candidate !== risks)) {
      await openPart(page, each);
      await expectPartPage(page, partOf(failed, each.area));
    }
    await expect(reviewMenu(page)).toHaveCount(farmersAreas.length);
    stages.end("the Risks card says Failed and its page gives the reason; the other six parts show the findings they had");

    expect.soft(recorder.failed, "no console call failed").toEqual([]);
  } finally {
    try {
      stages.stopped();
      const lines = log.all();
      findings.push(...findingsOfCalls(recorder.calls));
      findings.push(...findingsOfServer(lines.filter((line) => line.n > began)));
      findings.push(...findingsOfReviewLog(lines));
      const bootWarnings = lines.filter((line) => line.n <= began && line.level === "WARN");
      if (bootWarnings.length > 0) findings.push({ what: `${bootWarnings.length} WARN lines at boot: ${bootWarnings.map((line) => line.msg).join("; ")}`, where: "server log", evidence: `log lines ${bootWarnings.map((line) => line.n).join(", ")}`, severity: "low" });
      const leaked = secretLines(lines, [s.password]);
      if (leaked.length > 0) findings.push({ what: "something that looks like a secret in the server log", where: "server log", evidence: `log lines ${leaked.join(", ")}`, severity: "high" });
      const intro = [`Run on ${new Date().toISOString()} against ${s.hubName}.`, `Console: ${s.baseURL}. Draft: ${draftId}.`, "Calls are the browser's own (method, path, tool, status); log lines are the server's request log and the review runner's lines."];
      writeMonitor(join(s.shotsDir, monitorFile), renderMonitor("Backend monitor: Review an agency", intro, stages.rows, backend, dedupe(findings)));
      expect.soft(leaked, "no secret in the server log").toEqual([]);
    } finally {
      if (!process.env.E2E_KEEP_DRAFT) await archiveDraft(mcp, draftId).catch(() => undefined);
    }
  }
});
