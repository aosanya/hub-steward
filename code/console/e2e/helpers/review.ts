import { expect, type Locator, type Page } from "@playwright/test";
import type { Settings } from "./env";
import type { Mcp } from "./mcp";
import { requestsIn, tally, type Finding, type Recorder, type ServerLine, type ServerLog, type Stage } from "./monitor";

type Row = Record<string, unknown>;

export type Area = "profile" | "goals" | "objectives" | "roles_agents" | "workflows" | "risks" | "tests";

export type AreaEntry = { area: Area; label: string; page: string };

export const farmersAreas: AreaEntry[] = [
  { area: "profile", label: "Profile", page: "review-profile" },
  { area: "goals", label: "Goals", page: "review-goals" },
  { area: "objectives", label: "Objectives", page: "review-objectives" },
  { area: "roles_agents", label: "Roles", page: "review-roles" },
  { area: "workflows", label: "Workflows", page: "review-workflows" },
  { area: "risks", label: "Risks", page: "review-risks" },
  { area: "tests", label: "Tests", page: "review-tests" },
];

export const entryOf = (area: Area): AreaEntry => {
  const entry = farmersAreas.find((candidate) => candidate.area === area);
  if (!entry) throw new Error(`the farmers' parts have no ${area}`);
  return entry;
};

export const reviewTimeout = 10 * 60 * 1000;

export type NoteRead = { author: string; body: string };

export type FindingRead = { id: string; title: string; tool: string; status: string; fate: string; carriedFrom: string; notes: NoteRead[] };

export type PartRead = { reviewId: string; area: string; status: string; summary: string; failureReason: string; tokens: number; findings: FindingRead[] };

export type ReviewRead = { id: string; status: string; previousId: string; tokens: number; parts: PartRead[] };

export type Outcome =
  | { kind: "done"; summary: string; findings: { title: string; detail: string; tool: string; arguments: Row }[] }
  | { kind: "failed"; reason: string };

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const rowsOf = (value: unknown): Row[] => (Array.isArray(value) ? value.filter(isRow) : []);
const str = (value: unknown): string => (typeof value === "string" ? value : "");
const num = (value: unknown): number => (typeof value === "number" ? value : Number(value ?? 0) || 0);

const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();
const titleKey = (title: string): string => normalize(title).toLowerCase();

const findingOf = (row: Row): FindingRead => ({
  id: str(row.id),
  title: str(row.title),
  tool: str(row.tool),
  status: str(row.status),
  fate: str(row.fate),
  carriedFrom: str(row.carried_from_id),
  notes: rowsOf(row.comments).map((note) => ({ author: str(note.author), body: str(note.body) })),
});

const partOfRow = (row: Row): PartRead => ({
  reviewId: str(row.review_id),
  area: str(row.area),
  status: str(row.status),
  summary: str(row.summary),
  failureReason: str(row.failure_reason),
  tokens: num(row.tokens),
  findings: rowsOf(row.findings).map(findingOf),
});

export const readReview = async (mcp: Mcp, draftId: string): Promise<ReviewRead | null> => {
  const answer = await mcp.tool<Row>("agency_get_review", { draft_id: draftId });
  if (!isRow(answer.review)) return null;
  return {
    id: str(answer.review.id),
    status: str(answer.review.status),
    previousId: str(answer.review.previous_review_id),
    tokens: num(answer.review.tokens),
    parts: rowsOf(answer.areas).map(partOfRow),
  };
};

export const partOf = (review: ReviewRead, area: Area): PartRead => {
  const part = review.parts.find((candidate) => candidate.area === area);
  if (!part) throw new Error(`the review has no ${area} part`);
  return part;
};

export const findingTitled = (part: PartRead, title: string): FindingRead => {
  const finding = part.findings.find((candidate) => titleKey(candidate.title) === titleKey(title));
  if (!finding) throw new Error(`the ${part.area} part has no finding titled ${title}`);
  return finding;
};

export const shownFindings = (part: PartRead): FindingRead[] => {
  const at = new Map<string, number>();
  const kept: FindingRead[] = [];
  for (const finding of part.findings) {
    const key = titleKey(finding.title);
    const held = at.get(key);
    if (held === undefined) {
      at.set(key, kept.length);
      kept.push(finding);
    } else if (kept[held].status !== "open" && finding.status === "open") {
      kept[held] = finding;
    }
  }
  return kept.filter((finding) => finding.fate !== "fixed" && finding.fate !== "withdrawn");
};

export const openCount = (part: PartRead): number => shownFindings(part).filter((finding) => finding.status === "open").length;

export const cardValue = (part: PartRead): string => {
  if (part.status === "failed") return "Failed";
  if (part.status === "reading") return "Reading";
  return `${openCount(part)} open`;
};

export const partTokens = (review: ReviewRead): number => review.parts.filter((part) => part.reviewId === review.id).reduce((sum, part) => sum + part.tokens, 0);

export const carriedFindings = (review: ReviewRead): FindingRead[] => review.parts.flatMap((part) => part.findings).filter((finding) => finding.carriedFrom !== "");

export const describeReview = (label: string, review: ReviewRead): string => {
  const parts = review.parts.map((part) => `${part.area} ${part.status}${part.status === "failed" ? ` (${part.failureReason})` : ""}, ${part.findings.length} findings, ${part.tokens} tokens`);
  return `${label}: review ${review.id} ${review.status}, ${review.tokens} tokens in total, earlier review ${review.previousId || "none"}; ${parts.join("; ")}`;
};

export const recordOnePart = async (mcp: Mcp, draftId: string, area: Area, outcome: Outcome): Promise<string> => {
  const started = await mcp.tool<Row>("agency_start_review", { draft_id: draftId, area });
  const reviewId = str(isRow(started.review) ? started.review.id : started.id);
  if (reviewId === "") throw new Error("agency_start_review answered no review id");
  const report =
    outcome.kind === "failed"
      ? { status: "failed", summary: "", failure_reason: outcome.reason, tokens: 0, findings: [] }
      : {
          status: "done",
          summary: outcome.summary,
          failure_reason: "",
          tokens: 0,
          findings: outcome.findings.map((finding) => ({ ...finding, then: [], fate: "new", fate_reason: "", carried_from_id: "", reopen: false })),
        };
  await mcp.tool("agency_record_review_area", { review_id: reviewId, area, ...report });
  return reviewId;
};

export const cards = (page: Page): Locator => page.locator("a.tile");
export const reviewMenu = (page: Page): Locator => page.locator("nav.side a.nav-link.sub");
export const topMenu = (page: Page): Locator => page.locator("nav.side a.nav-link:not(.sub)");
export const rows = (page: Page): Locator => page.locator(".kept .finding");
export const progress = (page: Page): Locator => page.locator(".content p[role=status]");
export const button = (scope: Page | Locator, name: string): Locator => scope.getByRole("button", { name, exact: true });

export const progressPattern = new RegExp(`Reading \\d+ of ${farmersAreas.length} parts`);

export const signInAndOpenHub = async (page: Page, s: Settings): Promise<void> => {
  await page.goto("/#/login");
  await page.getByLabel("Email").fill(s.email);
  await page.getByLabel("Password").fill(s.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/#\/login/);
  if (/#\/hubs/.test(page.url())) {
    await page.locator(".card", { hasText: s.hubName }).getByRole("link", { name: "Open" }).first().click();
  }
  await expect(page).toHaveURL(/\/h\//);
};

export const openReview = async (page: Page): Promise<void> => {
  await topMenu(page).filter({ hasText: /^Review/ }).click();
  await expect(page).toHaveURL(/\/h\/[^/]+\/publish-review$/);
  await expect(page.getByRole("heading", { name: "Review", exact: true })).toBeVisible();
};

export const waitForCards = async (page: Page): Promise<void> => {
  await expect(cards(page).first()).toBeVisible({ timeout: reviewTimeout });
};

const expectPartOpened = async (page: Page, entry: AreaEntry): Promise<void> => {
  await expect(page).toHaveURL(new RegExp(`/h/[^/]+/${entry.page}$`));
  await expect(page.getByRole("heading", { name: `Review: ${entry.label}`, exact: true })).toBeVisible();
};

export const openPart = async (page: Page, entry: AreaEntry): Promise<void> => {
  await openReview(page);
  await waitForCards(page);
  await reviewMenu(page).filter({ hasText: new RegExp(`^${entry.label}`) }).click();
  await expectPartOpened(page, entry);
};

export const openPartByCard = async (page: Page, entry: AreaEntry): Promise<void> => {
  const index = farmersAreas.indexOf(entry);
  await cards(page).nth(index).click();
  await expectPartOpened(page, entry);
};

export const expectMenuOrder = async (page: Page): Promise<void> => {
  const names = (await topMenu(page).allInnerTexts()).map(normalize);
  const review = names.findIndex((name) => /^Review/.test(name));
  expect(review, "Review is a row of the menu").toBeGreaterThanOrEqual(0);
  expect(names[review + 1], "Publish is the row right under Review").toMatch(/^Publish/);
  await expect(page.locator("nav.side [role=separator] + a.nav-link", { hasText: /^Review/ }), "a divider sits above Review").toBeVisible();
  await expect(reviewMenu(page), "the parts sit under Review in the menu").toHaveText(farmersAreas.map((entry) => new RegExp(`^${entry.label}`)));
};

export const expectCards = async (page: Page, review: ReviewRead): Promise<void> => {
  await expect(cards(page)).toHaveCount(farmersAreas.length);
  for (const [index, entry] of farmersAreas.entries()) {
    const part = partOf(review, entry.area);
    await expect(cards(page).nth(index).locator(".tile-label"), `card ${index + 1} names ${entry.label}`).toHaveText(entry.label);
    await expect(cards(page).nth(index).locator(".tile-value"), `the ${entry.label} card shows what the database holds`).toHaveText(cardValue(part));
    if (part.status === "failed") await expect(cards(page).nth(index), `the ${entry.label} card looks failed`).toHaveClass(/\bbad\b/);
  }
};

export const expectPartPage = async (page: Page, part: PartRead): Promise<void> => {
  if (part.status === "failed") {
    await expect(page.locator(".tag.bad", { hasText: /^Failed$/ })).toBeVisible();
    await expect(page.getByText(part.failureReason, { exact: true })).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    return;
  }
  const expected = shownFindings(part).map((finding) => titleKey(finding.title)).sort();
  await expect(rows(page), "one row for each finding the database holds").toHaveCount(expected.length);
  const shown = (await rows(page).locator("h2").allInnerTexts()).map(titleKey).sort();
  expect(shown, `the ${part.area} page names the findings of the database`).toEqual(expected);
  if (part.summary !== "") {
    const summary = normalize(await page.locator(".kept .content .note").first().innerText());
    expect(summary, `the ${part.area} page opens with the summary of the database`).toBe(normalize(part.summary));
  }
  if (expected.length === 0) await expect(page.getByText("Nothing to fix in this part.")).toBeVisible();
};

export const sentencesIn = (text: string): number => normalize(text).split(/(?<=[.!?])\s+/).filter((sentence) => sentence !== "").length;

export const reviewPartLines = (lines: ServerLine[]): ServerLine[] => lines.filter((line) => line.msg.startsWith("review part") || line.msg === "reviewer panicked");

export const findingsOfReviewLog = (lines: ServerLine[]): Finding[] =>
  reviewPartLines(lines)
    .filter((line) => line.msg === "review part was already recorded" || line.msg === "review part left reading for the next start")
    .map((line) => ({ what: line.msg, where: "review runner", evidence: `log line ${line.n}`, severity: "medium" as const }));

export const dedupe = (findings: Finding[]): Finding[] => {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.what}|${finding.where}|${finding.evidence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export class Stages {
  readonly rows: Stage[] = [];
  private current = { name: "", mark: 0 };
  private running = false;

  constructor(
    private readonly recorder: Recorder,
    private readonly log: ServerLog,
  ) {}

  begin(name: string): void {
    this.recorder.stage = name;
    this.current = { name, mark: this.log.mark() };
    this.running = true;
  }

  stopped(): void {
    if (this.running) this.end("the walk stopped in this stage");
  }

  end(ui: string, tokens = ""): void {
    this.running = false;
    const lines = this.log.since(this.current.mark);
    this.rows.push({
      name: this.current.name,
      ui,
      calls: tally(this.recorder.in(this.current.name)),
      server: `${requestsIn(lines).length} requests, ${reviewPartLines(lines).length} review runner lines`,
      tokens,
    });
  }

  count(tool: string): number {
    return this.recorder.count(this.current.name, tool);
  }
}
