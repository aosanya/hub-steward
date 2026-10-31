import { readFileSync } from "node:fs";
import { join } from "node:path";
import { callTool } from "../wakala/mcp";
import {
  areaOf,
  areaOfPage,
  areaOrder,
  areaPageOf,
  commentFinding,
  getReview,
  listReviews,
  reviewProgress,
  setFindingStatus,
  startReview,
  toolsMissingSentence,
  type ReviewPage,
} from "./reviewApi";

vi.mock("../wakala/mcp");

type Args = Record<string, unknown>;

let calls: { hubId: string; tool: string; args: Args }[] = [];

const answerWith = (replies: Record<string, unknown>) => {
  calls = [];
  vi.mocked(callTool).mockImplementation(async (hubId, tool, args = {}) => {
    calls.push({ hubId, tool, args });
    const reply = replies[tool];
    if (reply instanceof Error) throw reply;
    return reply;
  });
};

const reviewRow = {
  id: "r2",
  draft_id: "d1",
  status: "running",
  previous_review_id: "r1",
  started_by: "ada",
  started_at: "2026-10-31T09:00:00Z",
  finished_at: "",
  tokens: 0,
};

const findingRow = {
  id: "f1",
  area_id: "a1",
  title: "Describe Farmer R-47",
  detail: "The role has no description.",
  tool: "agency_update_role",
  arguments: { code: "R-47" },
  then: [{ tool: "agency_list_roles", arguments: {} }],
  status: "open",
  fate: "still_open",
  fate_reason: "Still no description.",
  carried_from_id: "f0",
  comments: [
    {
      id: "c1",
      author: "ada",
      body: "On purpose.",
      created_at: "2026-10-30T08:00:00Z",
    },
  ],
};

const areaRow = (area: string, status: string, extra: Args = {}) => ({
  id: "a-" + area,
  review_id: "r2",
  area,
  status,
  tokens: 12,
  ...extra,
});

const sixAreas = [
  areaRow("goals", "done", {
    summary: "Goals read well. One has no owner.",
    findings: [findingRow],
  }),
  areaRow("objectives", "reading"),
  areaRow("roles_agents", "failed", {
    failure_reason: "The allowance ran out.",
  }),
  areaRow("workflows", "reading"),
  areaRow("risks", "done"),
  areaRow("tests", "reading"),
];

const pageAnswer = { review: reviewRow, areas: sixAreas };

describe("starting a review", () => {
  it("asks agency_run_review for the draft on the hub and reads the new run", async () => {
    answerWith({ agency_run_review: pageAnswer });
    const page = await startReview("h1", "d1");
    expect(calls).toEqual([
      { hubId: "h1", tool: "agency_run_review", args: { draft_id: "d1" } },
    ]);
    expect(page.review).toMatchObject({
      id: "r2",
      status: "running",
      previous_review_id: "r1",
      started_by: "ada",
    });
    expect(page.areas).toHaveLength(6);
  });

  it("names the one area when a single part is to be reviewed", async () => {
    answerWith({ agency_run_review: pageAnswer });
    await startReview("h1", "d1", "goals");
    expect(calls).toEqual([
      { hubId: "h1", tool: "agency_run_review", args: { draft_id: "d1", area: "goals" } },
    ]);
  });

  it("surfaces the refusal as its plain sentence", async () => {
    answerWith({
      agency_run_review: new Error(
        "agency_run_review: A review of this draft is already running.",
      ),
    });
    await expect(startReview("h1", "d1")).rejects.toThrow(
      new Error("A review of this draft is already running."),
    );
  });

  it("keeps a sentence that has no tool name in front of it as it is", async () => {
    answerWith({
      agency_run_review: new Error("No default AI account is set."),
    });
    await expect(startReview("h1", "d1")).rejects.toThrow(
      "No default AI account is set.",
    );
  });

  it("says so when the answer carries no review", async () => {
    answerWith({ agency_run_review: {} });
    await expect(startReview("h1", "d1")).rejects.toThrow(
      "the review did not start",
    );
  });
});

describe("reading a review", () => {
  it("asks for a review by its id", async () => {
    answerWith({ agency_get_review: pageAnswer });
    await getReview("h1", { reviewId: "r2" });
    expect(calls).toEqual([
      { hubId: "h1", tool: "agency_get_review", args: { review_id: "r2" } },
    ]);
  });

  it("asks for the latest review by the draft", async () => {
    answerWith({ agency_get_review: pageAnswer });
    await getReview("h1", { draftId: "d1" });
    expect(calls).toEqual([
      { hubId: "h1", tool: "agency_get_review", args: { draft_id: "d1" } },
    ]);
  });

  it("returns null when the draft has no review", async () => {
    answerWith({ agency_get_review: { review: null } });
    expect(await getReview("h1", { draftId: "d1" })).toBeNull();
  });

  it("reads each area with its summary, failure reason, tokens and findings", async () => {
    answerWith({ agency_get_review: pageAnswer });
    const page = (await getReview("h1", { draftId: "d1" })) as ReviewPage;
    expect(page.areas.map((area) => [area.area, area.status])).toEqual([
      ["goals", "done"],
      ["objectives", "reading"],
      ["roles_agents", "failed"],
      ["workflows", "reading"],
      ["risks", "done"],
      ["tests", "reading"],
    ]);
    expect(page.areas[0]).toMatchObject({
      summary: "Goals read well. One has no owner.",
      tokens: 12,
    });
    expect(page.areas[2].failure_reason).toBe("The allowance ran out.");
    expect(page.areas[0].findings[0]).toEqual(findingRow);
  });

  it("gives a finding with nothing else on it open, new and without comments", async () => {
    answerWith({
      agency_get_review: {
        review: reviewRow,
        areas: [
          areaRow("risks", "done", {
            findings: [{ id: "f9", title: "Name a risk" }],
          }),
        ],
      },
    });
    const page = (await getReview("h1", { draftId: "d1" })) as ReviewPage;
    expect(page.areas[0].findings[0]).toMatchObject({
      id: "f9",
      title: "Name a risk",
      status: "open",
      fate: "new",
      comments: [],
      then: [],
    });
  });

  it("gives an area still being read an empty list of findings", async () => {
    answerWith({
      agency_get_review: {
        review: reviewRow,
        areas: [areaRow("risks", "reading")],
      },
    });
    expect(
      ((await getReview("h1", { draftId: "d1" })) as ReviewPage).areas[0]
        .findings,
    ).toEqual([]);
  });

  it("surfaces a refusal", async () => {
    answerWith({
      agency_get_review: new Error(
        "agency_get_review: That review is not on this agency.",
      ),
    });
    await expect(getReview("h1", { reviewId: "r9" })).rejects.toThrow(
      "That review is not on this agency.",
    );
  });
});

describe("listing reviews", () => {
  it("asks agency_list_reviews for the draft and keeps the order it was given", async () => {
    answerWith({
      agency_list_reviews: {
        items: [reviewRow, { ...reviewRow, id: "r1", status: "done" }],
      },
    });
    const reviews = await listReviews("h1", "d1");
    expect(calls).toEqual([
      { hubId: "h1", tool: "agency_list_reviews", args: { draft_id: "d1" } },
    ]);
    expect(reviews.map((review) => [review.id, review.status])).toEqual([
      ["r2", "running"],
      ["r1", "done"],
    ]);
  });

  it("returns an empty list when there are none", async () => {
    answerWith({ agency_list_reviews: {} });
    expect(await listReviews("h1", "d1")).toEqual([]);
  });
});

describe("answering a finding", () => {
  it("sets its status with finding_id and status and returns the finding", async () => {
    answerWith({
      agency_set_finding_status: { ...findingRow, status: "dismissed" },
    });
    const finding = await setFindingStatus("h1", "f1", "dismissed");
    expect(calls).toEqual([
      {
        hubId: "h1",
        tool: "agency_set_finding_status",
        args: { finding_id: "f1", status: "dismissed" },
      },
    ]);
    expect(finding).toMatchObject({
      id: "f1",
      status: "dismissed",
      title: "Describe Farmer R-47",
    });
  });

  it("surfaces a refusal", async () => {
    answerWith({
      agency_set_finding_status: new Error(
        "agency_set_finding_status: That finding is gone.",
      ),
    });
    await expect(setFindingStatus("h1", "f1", "applied")).rejects.toThrow(
      "That finding is gone.",
    );
  });

  it("comments with finding_id and body and returns the comment", async () => {
    answerWith({
      agency_comment_finding: {
        id: "c2",
        finding_id: "f1",
        author: "ada",
        body: "Leave it.",
        created_at: "2026-10-31T09:05:00Z",
      },
    });
    const comment = await commentFinding("h1", "f1", "Leave it.");
    expect(calls).toEqual([
      {
        hubId: "h1",
        tool: "agency_comment_finding",
        args: { finding_id: "f1", body: "Leave it." },
      },
    ]);
    expect(comment).toEqual({
      id: "c2",
      author: "ada",
      body: "Leave it.",
      created_at: "2026-10-31T09:05:00Z",
    });
  });

  it("surfaces a refusal to comment", async () => {
    answerWith({
      agency_comment_finding: new Error(
        "agency_comment_finding: A comment needs some words.",
      ),
    });
    await expect(commentFinding("h1", "f1", "")).rejects.toThrow(
      "A comment needs some words.",
    );
  });
});

describe("the progress card", () => {
  it("counts the areas that are not reading", async () => {
    answerWith({ agency_get_review: pageAnswer });
    const page = (await getReview("h1", { draftId: "d1" })) as ReviewPage;
    expect(reviewProgress(page)).toEqual({ done: 3, total: 6 });
  });

  it("counts only the parts of the running review, not the earlier results of the other parts", async () => {
    const mine = areaRow("goals", "reading");
    const earlier = areaRow("risks", "done", { review_id: "r1" });
    answerWith({ agency_get_review: { review: reviewRow, areas: [mine, earlier] } });
    const page = (await getReview("h1", { draftId: "d1" })) as ReviewPage;
    expect(reviewProgress(page)).toEqual({ done: 0, total: 1 });
  });

  it("counts five parts for an agency without objectives and none done at the start", async () => {
    const areas = ["goals", "roles_agents", "workflows", "risks", "tests"].map(
      (area) => areaRow(area, "reading"),
    );
    answerWith({ agency_run_review: { review: reviewRow, areas } });
    expect(reviewProgress(await startReview("h1", "d1"))).toEqual({
      done: 0,
      total: 5,
    });
  });
});

describe("a backend without the review tools", () => {
  it("says so in a plain sentence when reading and when starting", async () => {
    answerWith({
      agency_get_review: new Error('unknown tool "agency_get_review"'),
      agency_run_review: new Error('unknown tool "agency_run_review"'),
    });

    await expect(getReview("h1", { draftId: "d1" })).rejects.toThrow(
      toolsMissingSentence,
    );
    await expect(startReview("h1", "d1")).rejects.toThrow(toolsMissingSentence);
  });
});

describe("the tab order", () => {
  it("shows Objectives for the farmers' agency", () => {
    expect(areaOrder("farmers")).toEqual([
      { area: "profile", label: "Profile" },
      { area: "goals", label: "Goals" },
      { area: "objectives", label: "Objectives" },
      { area: "roles_agents", label: "Roles and agents" },
      { area: "workflows", label: "Workflows" },
      { area: "risks", label: "Risks" },
      { area: "tests", label: "Tests" },
    ]);
  });

  it.each(["lab", "riders"] as const)(
    "leaves Objectives out for the %s agency",
    (kind) => {
      expect(areaOrder(kind).map((tab) => tab.label)).toEqual([
        "Profile",
        "Goals",
        "Roles and agents",
        "Workflows",
        "Risks",
        "Tests",
      ]);
    },
  );
});

describe("where the review lives", () => {
  it("keeps nothing in the browser", () => {
    const source = readFileSync(join(__dirname, "reviewApi.ts"), "utf8");
    expect(source).not.toMatch(
      /localStorage|sessionStorage|indexedDB|document\.cookie/i,
    );
  });
});

describe("the page each review area opens", () => {
  it("names one review page per area", () => {
    expect(areaOrder("farmers").map((tab) => areaPageOf(tab.area))).toEqual([
      "review-profile",
      "review-goals",
      "review-objectives",
      "review-roles",
      "review-workflows",
      "review-risks",
      "review-tests",
    ]);
  });

  it("finds the area back from its page, and nothing for any other page", () => {
    for (const tab of areaOrder("farmers"))
      expect(areaOfPage(areaPageOf(tab.area))).toBe(tab.area);
    expect(areaOfPage("publish-review")).toBeUndefined();
    expect(areaOfPage("goals")).toBeUndefined();
    expect(areaOfPage("constructor")).toBeUndefined();
  });
});

describe("an area that holds the same finding several times", () => {
  it("shows it once, keeping the copy that is still open", () => {
    const area = areaOf({
      id: "a1",
      review_id: "r1",
      area: "roles_agents",
      status: "done",
      findings: [
        { id: "f1", title: "Describe Group coordinator R-50", status: "applied" },
        { id: "f2", title: "Describe  group coordinator r-50", status: "open" },
        { id: "f3", title: "Describe Group coordinator R-50", status: "open" },
        { id: "f4", title: "Describe Buyer R-48", status: "open" },
      ],
    });
    expect(area.findings.map((finding) => finding.id)).toEqual(["f2", "f4"]);
  });
});
