import type { Badges } from "./menu";
import { workingDraftId } from "./draft";
import { isActionable } from "./actionable";
import { getReview, type ReviewArea } from "./reviewApi";

const pageOfArea: Record<string, string> = {
  profile: "review-profile",
  goals: "review-goals",
  objectives: "review-objectives",
  roles_agents: "review-roles",
  workflows: "review-workflows",
  risks: "review-risks",
  tests: "review-tests",
};

const openIn = (area: ReviewArea) => area.findings.filter((finding) => isActionable(finding) && finding.status === "open").length;

export async function loadReviewBadges(hubId: string): Promise<Badges> {
  const draftId = await workingDraftId(hubId);
  if (draftId === "") return {};
  const page = await getReview(hubId, { draftId });
  if (!page) return {};
  const counted: Badges = {};
  for (const area of page.areas) {
    const open = openIn(area);
    const target = pageOfArea[area.area];
    if (open > 0 && target) counted[target] = open;
  }
  return counted;
}
