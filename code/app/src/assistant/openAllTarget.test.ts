import { draftOf, listTool, openAllTarget, type ResultDraft } from "./results";
import { issuesPath } from "../backlogs/paths";
import { smartBacklogPath } from "../smartBacklog/paths";
import { openAgency, forgetOpenAgency } from "../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const backlogs = [
  { id: "b1", name: "Software", steps: ["To do"], issues: 5 },
  { id: "s1", name: "Ready to start", steps: [], issues: 9, kind: "smart" as const },
];

const draftFor = (args: Record<string, unknown>, total = 100) => draftOf(listTool, args, { total, items: [{ id: "i1", title: "DEV-001 A" }] }) as ResultDraft;

describe("where Open all goes", () => {
  it("reads the tag, the repo and the words of the call as the List's filter", () => {
    const list = draftFor({ tag: "Blocked", repo: "hub-steward", q: "import" });
    expect(openAllTarget(list, backlogs)).toEqual({ label: "Open all 100 issues", to: issuesPath("all", ["Blocked", "hub-steward"], "import"), whole: false });
  });

  it("opens a backlog by its name or id, case aside", () => {
    expect(openAllTarget(draftFor({ backlog: "software", tag: "Blocked" }), backlogs).to).toBe(issuesPath("b1", ["Blocked"]));
    expect(openAllTarget(draftFor({ backlog: "b1" }), backlogs).to).toBe(issuesPath("b1"));
  });

  it("opens a smart backlog only when nothing else narrows it", () => {
    expect(openAllTarget(draftFor({ backlog: "Ready to start" }), backlogs).to).toBe(smartBacklogPath("s1"));
    expect(openAllTarget(draftFor({ backlog: "Ready to start", tag: "Blocked" }), backlogs)).toMatchObject({ to: issuesPath(), whole: true });
  });

  it("opens All issues, as the whole, for a backlog that is not found or a step or priority filter", () => {
    expect(openAllTarget(draftFor({ backlog: "Nowhere" }), backlogs)).toEqual({ label: "Open all issues", to: issuesPath(), whole: true });
    expect(openAllTarget(draftFor({ step: "Doing" }), backlogs)).toMatchObject({ to: issuesPath(), whole: true });
    expect(openAllTarget(draftFor({ priority: "P1" }), backlogs)).toMatchObject({ to: issuesPath(), whole: true });
  });

  it("opens All issues with the count when the call had no filter", () => {
    expect(openAllTarget(draftFor({}, 724), backlogs)).toEqual({ label: "Open all 724 issues", to: issuesPath(), whole: false });
  });
});
