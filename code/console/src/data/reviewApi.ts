import { callTool } from "../wakala/mcp";
import type { SuggestionStep } from "./chatAnswer";
import type { HubKind } from "./hubKind";
import { isRecord, textOf, type Item } from "./pages/groups";

export type AreaName = "profile" | "goals" | "objectives" | "roles_agents" | "workflows" | "risks" | "tests";

export type ReviewStatus = "running" | "done" | "failed";

export type AreaStatus = "reading" | "done" | "failed";

export type FindingStatus = "open" | "applied" | "dismissed";

export type Fate = "new" | "fixed" | "still_open" | "withdrawn";

export type FindingComment = { id: string; author: string; body: string; created_at: string };

export type Finding = {
  id: string;
  area_id: string;
  title: string;
  detail: string;
  tool: string;
  arguments: Record<string, unknown>;
  then: SuggestionStep[];
  status: FindingStatus;
  fate: Fate;
  fate_reason: string;
  carried_from_id: string;
  comments: FindingComment[];
};

export type ReviewArea = {
  id: string;
  review_id: string;
  area: AreaName;
  status: AreaStatus;
  failure_reason: string;
  summary: string;
  tokens: number;
  findings: Finding[];
};

export type Review = {
  id: string;
  draft_id: string;
  status: ReviewStatus;
  previous_review_id: string;
  started_by: string;
  started_at: string;
  finished_at: string;
  tokens: number;
};

export type ReviewPage = { review: Review; areas: ReviewArea[] };

export type ReviewTarget = { reviewId: string } | { draftId: string };

export type AreaTab = { area: AreaName; label: string };

export type Progress = { done: number; total: number };

export const reviewPollMs = 2000;

const areaLabels: Record<AreaName, string> = {
  profile: "Profile",
  goals: "Goals",
  objectives: "Objectives",
  roles_agents: "Roles and agents",
  workflows: "Workflows",
  risks: "Risks",
  tests: "Tests",
};

const tabOrder: AreaName[] = ["profile", "goals", "objectives", "roles_agents", "workflows", "risks", "tests"];

const pick = <T extends string>(value: string, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const listOf = (value: unknown): Item[] => (Array.isArray(value) ? value.filter(isRecord) : []);

const numberOf = (record: Item, key: string): number => (typeof record[key] === "number" ? (record[key] as number) : 0);

const stepOf = (item: Item): SuggestionStep => ({
  tool: textOf(item, "tool"),
  arguments: isRecord(item.arguments) ? item.arguments : {},
});

export const commentOf = (item: Item): FindingComment => ({
  id: textOf(item, "id"),
  author: textOf(item, "author"),
  body: textOf(item, "body"),
  created_at: textOf(item, "created_at"),
});

export const findingOf = (item: Item): Finding => ({
  id: textOf(item, "id"),
  area_id: textOf(item, "area_id"),
  title: textOf(item, "title"),
  detail: textOf(item, "detail"),
  tool: textOf(item, "tool"),
  arguments: isRecord(item.arguments) ? item.arguments : {},
  then: listOf(item.then).map(stepOf),
  status: pick(textOf(item, "status"), ["open", "applied", "dismissed"] as const, "open"),
  fate: pick(textOf(item, "fate"), ["new", "fixed", "still_open", "withdrawn"] as const, "new"),
  fate_reason: textOf(item, "fate_reason"),
  carried_from_id: textOf(item, "carried_from_id"),
  comments: listOf(item.comments).map(commentOf),
});

const titleKey = (title: string): string => title.trim().replace(/\s+/g, " ").toLowerCase();

export const withoutRepeats = (findings: Finding[]): Finding[] => {
  const at = new Map<string, number>();
  const kept: Finding[] = [];
  for (const finding of findings) {
    const key = titleKey(finding.title);
    const held = at.get(key);
    if (held === undefined) {
      at.set(key, kept.length);
      kept.push(finding);
    } else if (kept[held].status !== "open" && finding.status === "open") {
      kept[held] = finding;
    }
  }
  return kept;
};

export const areaOf = (item: Item): ReviewArea => ({
  id: textOf(item, "id"),
  review_id: textOf(item, "review_id"),
  area: pick(textOf(item, "area"), tabOrder, "goals"),
  status: pick(textOf(item, "status"), ["reading", "done", "failed"] as const, "reading"),
  failure_reason: textOf(item, "failure_reason"),
  summary: textOf(item, "summary"),
  tokens: numberOf(item, "tokens"),
  findings: withoutRepeats(listOf(item.findings).map(findingOf)),
});

export const reviewOf = (item: Item): Review => ({
  id: textOf(item, "id"),
  draft_id: textOf(item, "draft_id"),
  status: pick(textOf(item, "status"), ["running", "done", "failed"] as const, "running"),
  previous_review_id: textOf(item, "previous_review_id"),
  started_by: textOf(item, "started_by"),
  started_at: textOf(item, "started_at"),
  finished_at: textOf(item, "finished_at"),
  tokens: numberOf(item, "tokens"),
});

const pageOf = (answer: unknown): ReviewPage | null =>
  isRecord(answer) && isRecord(answer.review) ? { review: reviewOf(answer.review), areas: listOf(answer.areas).map(areaOf) } : null;

export const toolsMissingSentence = "Review is not available on this backend yet. Restart it so it picks up the review tools.";

export const sentenceOf = (error: unknown): string => {
  if (!(error instanceof Error)) return "the review could not be reached";
  if (/unknown tool/i.test(error.message)) return toolsMissingSentence;
  return error.message.replace(/^[a-z_]+:\s*/, "");
};

const asked = async <T>(hubId: string, tool: string, args: Record<string, unknown>): Promise<T> => {
  try {
    return await callTool<T>(hubId, tool, args);
  } catch (error) {
    throw new Error(sentenceOf(error));
  }
};

export const startReview = async (hubId: string, draftId: string, area?: AreaName): Promise<ReviewPage> => {
  const page = pageOf(await asked<unknown>(hubId, "agency_run_review", area ? { draft_id: draftId, area } : { draft_id: draftId }));
  if (!page) throw new Error("the review did not start");
  return page;
};

export const getReview = async (hubId: string, target: ReviewTarget): Promise<ReviewPage | null> =>
  pageOf(
    await asked<unknown>(
      hubId,
      "agency_get_review",
      "reviewId" in target ? { review_id: target.reviewId } : { draft_id: target.draftId },
    ),
  );

export const listReviews = async (hubId: string, draftId: string): Promise<Review[]> => {
  const answer = await asked<unknown>(hubId, "agency_list_reviews", { draft_id: draftId });
  return listOf(isRecord(answer) ? answer.items : []).map(reviewOf);
};

export const setFindingStatus = async (hubId: string, findingId: string, status: FindingStatus): Promise<Finding> => {
  const answer = await asked<unknown>(hubId, "agency_set_finding_status", { finding_id: findingId, status });
  if (!isRecord(answer)) throw new Error("the finding could not be changed");
  return findingOf(answer);
};

export const commentFinding = async (hubId: string, findingId: string, body: string): Promise<FindingComment> => {
  const answer = await asked<unknown>(hubId, "agency_comment_finding", { finding_id: findingId, body });
  if (!isRecord(answer)) throw new Error("the comment could not be saved");
  return commentOf(answer);
};

export const reviewProgress = (page: ReviewPage): Progress => {
  const running = page.areas.filter((area) => area.review_id === page.review.id);
  return { done: running.filter((area) => area.status !== "reading").length, total: running.length };
};

export const readsEveryArea = (page: ReviewPage): boolean => reviewProgress(page).total === page.areas.length;

export const areaOrder = (kind: HubKind): AreaTab[] =>
  tabOrder
    .filter((area) => area !== "objectives" || kind === "farmers")
    .map((area) => ({ area, label: areaLabels[area] }));

export const areaLabel = (area: AreaName): string => areaLabels[area];

const areaPages: Record<AreaName, string> = {
  profile: "review-profile",
  goals: "review-goals",
  objectives: "review-objectives",
  roles_agents: "review-roles",
  workflows: "review-workflows",
  risks: "review-risks",
  tests: "review-tests",
};

export const areaPageOf = (area: AreaName): string => areaPages[area];

export const areaOfPage = (page: string): AreaName | undefined => tabOrder.find((area) => areaPages[area] === page);
