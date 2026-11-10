import { describe, expect, it, vi } from "vitest";
import { publishPage } from "./publishModule";
import { publishReviewPage } from "./publishReviewModule";

const rows = vi.hoisted(() => ({ notPassedRows: vi.fn() }));

vi.mock("./publishData", () => rows);

describe("the Publish page module", () => {
  it("is the publish page with a Publish button and a scenario and result column", () => {
    expect(publishPage.spec).toMatchObject({ id: "publish", primary: "Publish" });
    expect(publishPage.spec.columns.map((column) => column.key)).toEqual(["name", "result"]);
  });

  it("names the tool that publishes among the tools it may use", () => {
    expect(publishPage.spec.tools).toContain("agency_publish_agency");
    expect(publishPage.spec.tools).toContain("agency_list_publications");
  });

  it("lists the scenarios that have not passed as its rows", async () => {
    rows.notPassedRows.mockResolvedValue([{ id: "s1", name: "Buy now", result: "failed" }]);
    expect(await publishPage.rows("h1", {})).toEqual([{ id: "s1", name: "Buy now", result: "failed" }]);
    expect(rows.notPassedRows).toHaveBeenCalledWith("h1");
  });
});

describe("the Publish review page module", () => {
  it("is the review page with a Run review button and the review tools", () => {
    expect(publishReviewPage.spec).toMatchObject({ id: "publish-review", primary: "Run review" });
    expect(publishReviewPage.spec.tools).toEqual(["agency_get_review", "agency_run_review", "agency_set_finding_status", "agency_comment_finding"]);
  });

  it("has no rows of its own", async () => {
    expect(await publishReviewPage.rows("h1", {})).toEqual([]);
  });
});
