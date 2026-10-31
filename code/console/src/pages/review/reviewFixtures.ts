import type { AreaName, Finding, FindingComment, Review, ReviewArea, ReviewPage } from "../../data/reviewApi";

export const finding = (over: Partial<Finding> = {}): Finding => ({
  id: "f-1",
  area_id: "a-goals",
  title: "Describe Farmer R-47",
  detail: "The Farmer role has no description, so an agent cannot tell what it may do.",
  tool: "agency_update_role",
  arguments: { role_id: "r-47", name: "Farmer", description: "" },
  then: [],
  status: "open",
  fate: "new",
  fate_reason: "",
  carried_from_id: "",
  comments: [],
  ...over,
});

export const comment = (over: Partial<FindingComment> = {}): FindingComment => ({
  id: "c-1",
  author: "Designer",
  body: "Farmers are described on the Profile page.",
  created_at: "2026-10-31T09:00:00Z",
  ...over,
});

export const area = (name: AreaName, over: Partial<ReviewArea> = {}): ReviewArea => ({
  id: `a-${name}`,
  review_id: "rv-1",
  area: name,
  status: "done",
  failure_reason: "",
  summary: "Two sentences about this part. The second sentence says what to do first.",
  tokens: 1200,
  findings: [],
  ...over,
});

export const review = (over: Partial<Review> = {}): Review => ({
  id: "rv-1",
  draft_id: "d-1",
  status: "done",
  previous_review_id: "",
  started_by: "Designer",
  started_at: "2026-10-31T08:58:00Z",
  finished_at: "2026-10-31T08:59:00Z",
  tokens: 7200,
  ...over,
});

export const farmersAreas = (): AreaName[] => ["goals", "objectives", "roles_agents", "workflows", "risks", "tests"];

export const page = (over: Partial<ReviewPage> = {}): ReviewPage => ({
  review: review(),
  areas: farmersAreas().map((name) => area(name, { findings: name === "goals" ? [finding(), finding({ id: "f-2", title: "Give goal G-2 a number" })] : [] })),
  ...over,
});

export const runningPage = (reading: number): ReviewPage => ({
  review: review({ status: "running", finished_at: "" }),
  areas: farmersAreas().map((name, i) => area(name, i < 6 - reading ? {} : { status: "reading", summary: "", tokens: 0 })),
});

export const failedAreaPage = (): ReviewPage => ({
  review: review(),
  areas: farmersAreas().map((name) => (name === "risks" ? area(name, { status: "failed", failure_reason: "The risk register could not be read.", summary: "" }) : area(name))),
});
